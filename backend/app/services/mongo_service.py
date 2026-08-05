from __future__ import annotations

import logging
import secrets
from dataclasses import dataclass

from app.core.config import settings
from app.models.response import AnalysisResult, HistoryItem, HistoryListResponse

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class DeleteAnalysisResult:
    deleted: bool
    qdrant_vector_id: str | None = None


class MongoService:
    def __init__(self) -> None:
        self._client = None
        self._collection = None
        self._indexes_ready = False

    @property
    def is_configured(self) -> bool:
        return bool(settings.mongodb_uri)

    def _get_collection(self):
        if not self.is_configured:
            logger.warning("MongoDB URI not configured - disk persistence disabled")
            return None

        if self._collection is None:
            from motor.motor_asyncio import AsyncIOMotorClient
            import certifi

            try:
                self._client = AsyncIOMotorClient(
                    settings.mongodb_uri,
                    tls=True,
                    tlsCAFile=certifi.where(),
                    serverSelectionTimeoutMS=10000,
                    socketTimeoutMS=15000,
                    connectTimeoutMS=10000,
                )
                database = self._client[settings.mongodb_database]
                self._collection = database[settings.mongodb_collection]
                logger.info("MongoDB connection established successfully")
            except Exception as e:
                logger.error(f"Failed to connect to MongoDB: {e}")
                return None

        return self._collection

    async def _ensure_indexes(self) -> None:
        await self.create_indexes()

    async def _create_index_safely(self, collection, keys, *, name, **kwargs) -> None:
        """
        Create an index, tolerating the case where the same key pattern already
        exists under a different name (MongoDB error code 85). This keeps the
        migration from old unnamed indexes idempotent.
        """
        try:
            await collection.create_index(keys, name=name, **kwargs)
        except Exception as exc:
            if getattr(exc, "code", None) == 85:
                logger.debug("Index %s already exists under a different name: %s", name, exc)
            else:
                raise

    async def create_indexes(self) -> None:
        """
        Create all MongoDB indexes across every collection.
        Called once on app startup. Idempotent — safe to run on every restart.
        """
        if self._indexes_ready:
            return

        collection = self._get_collection()
        if collection is None:
            return

        # ── analyses collection ──────────────────────────────────────────────
        # Most common query: get all analyses for a user, sorted by date
        await self._create_index_safely(
            collection,
            [("user_id", 1), ("timestamp", -1)],
            name="user_history_idx",
        )
        await self._create_index_safely(
            collection,
            "analysis_id",
            name="analysis_id_unique_idx",
            unique=True,
        )
        await self._create_index_safely(
            collection,
            "share_slug",
            name="share_slug_unique_idx",
            unique=True,
            sparse=True,
        )

        # ── rate_limits collection ───────────────────────────────────────────
        rate_limits_collection = collection.database.rate_limits
        await self._create_index_safely(
            rate_limits_collection,
            [("user_id", 1), ("date", 1)],
            name="rate_limit_user_date_idx",
            unique=True,
        )
        # Auto-expire old rate limit documents after 2 days
        await self._create_index_safely(
            rate_limits_collection,
            "date",
            name="rate_limit_ttl_idx",
            expireAfterSeconds=172800,
        )

        # ── users collection ─────────────────────────────────────────────────
        users_collection = collection.database.users
        await self._create_index_safely(
            users_collection,
            "user_id",
            name="user_id_unique_idx",
            unique=True,
        )
        await self._create_index_safely(
            users_collection,
            "stripe_customer_id",
            name="stripe_customer_idx",
        )

        # ── resumes collection ───────────────────────────────────────────────
        resumes_collection = collection.database.resumes
        await self._create_index_safely(
            resumes_collection,
            [("user_id", 1), ("created_at", -1)],
            name="resume_user_date_idx",
        )

        # ── learning_plans collection ────────────────────────────────────────
        learning_plans = collection.database.learning_plans
        await self._create_index_safely(
            learning_plans,
            "skill",
            name="skill_unique_idx",
            unique=True,
        )
        await self._create_index_safely(
            learning_plans,
            "created_at",
            name="learning_plan_ttl_idx",
            expireAfterSeconds=604800,  # 7-day TTL — auto-expire stale plans
        )

        # ── scraped_jds collection ───────────────────────────────────────────
        scraped_jds = collection.database.scraped_jds
        await self._create_index_safely(
            scraped_jds,
            "url",
            name="url_unique_idx",
            unique=True,
        )
        await self._create_index_safely(
            scraped_jds,
            "scraped_at",
            name="scraped_jd_ttl_idx",
            expireAfterSeconds=86400,  # 24-hour TTL for scraped JDs
        )

        # ── job_applications collection ──────────────────────────────────────
        applications_collection = collection.database.job_applications
        await self._create_index_safely(
            applications_collection,
            [("user_id", 1), ("updated_at", -1)],
            name="application_user_date_idx",
        )

        self._indexes_ready = True
        logger.info("MongoDB indexes created/verified successfully")

    async def save_analysis(
        self,
        *,
        user_id: str,
        result: AnalysisResult,
        resume_text: str,
        qdrant_vector_id: str | None = None,
    ) -> bool:
        collection = self._get_collection()
        if collection is None:
            return False

        await self._ensure_indexes()
        document = result.model_dump(mode="json")
        document.update(
            {
                "user_id": user_id,
                "qdrant_vector_id": qdrant_vector_id,
                "share_slug": secrets.token_urlsafe(10),
                "is_public": False,  # Private by default — user must enable sharing
            }
        )
        # Only store resume snippet if explicitly enabled (privacy setting)
        if settings.store_resume_snippet:
            document["resume_snippet"] = resume_text[:500]
        await collection.insert_one(document)
        return True

    async def list_history(
        self,
        *,
        user_id: str,
        limit: int = 10,
        skip: int = 0,
    ) -> HistoryListResponse:
        collection = self._get_collection()
        if collection is None:
            return HistoryListResponse(analyses=[], total=0)

        import time

        start = time.perf_counter()
        query = {"user_id": user_id}
        total = await collection.count_documents(query)
        cursor = (
            collection.find(query, {"_id": 0})
            .sort("timestamp", -1)
            .skip(skip)
            .limit(limit)
        )
        analyses = [
            HistoryItem(
                analysis_id=document["analysis_id"],
                job_title=document["job_title"],
                timestamp=document["timestamp"],
                scores=document["scores"],
            )
            async for document in cursor
        ]

        elapsed_ms = (time.perf_counter() - start) * 1000
        if elapsed_ms > settings.slow_query_threshold_ms:
            logger.warning(
                "Slow query: list_history for user=%s took %.0fms (limit=%d, skip=%d)",
                user_id,
                elapsed_ms,
                limit,
                skip,
            )

        return HistoryListResponse(analyses=analyses, total=total)

    async def get_analysis(self, *, user_id: str, analysis_id: str) -> AnalysisResult | None:
        collection = self._get_collection()
        if collection is None:
            return None

        document = await collection.find_one(
            {"user_id": user_id, "analysis_id": analysis_id},
            {"_id": 0, "user_id": 0, "resume_snippet": 0, "qdrant_vector_id": 0},
        )
        if document is None:
            return None

        return AnalysisResult.model_validate(document)

    async def delete_analysis(self, *, user_id: str, analysis_id: str) -> DeleteAnalysisResult:
        collection = self._get_collection()
        if collection is None:
            return DeleteAnalysisResult(deleted=False)

        document = await collection.find_one(
            {"user_id": user_id, "analysis_id": analysis_id},
            {"qdrant_vector_id": 1},
        )
        if document is None:
            return DeleteAnalysisResult(deleted=False)

        result = await collection.delete_one({"user_id": user_id, "analysis_id": analysis_id})
        return DeleteAnalysisResult(
            deleted=result.deleted_count == 1,
            qdrant_vector_id=document.get("qdrant_vector_id"),
        )


mongo_service = MongoService()


def learning_plans_collection():
    """Return the learning_plans collection, or None if MongoDB is unavailable."""
    collection = mongo_service._get_collection()
    if collection is None:
        return None
    return collection.database.learning_plans
