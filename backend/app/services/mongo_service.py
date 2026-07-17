from __future__ import annotations

import logging
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
        if self._indexes_ready:
            return

        collection = self._get_collection()
        if collection is None:
            return

        await collection.create_index([("user_id", 1), ("timestamp", -1)])
        await collection.create_index("analysis_id", unique=True)

        # Rate limit indexes - expire documents after 2 days automatically
        rate_limits_collection = collection.database.rate_limits
        await rate_limits_collection.create_index("user_id")
        await rate_limits_collection.create_index(
            "date",
            expireAfterSeconds=172800,  # Auto-delete docs after 2 days
        )

        self._indexes_ready = True

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