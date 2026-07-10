from __future__ import annotations

import asyncio
import logging

from app.core.config import settings
from app.models.response import AnalysisResult
from app.services.parser import ParsedResume

logger = logging.getLogger(__name__)

DEFAULT_CONTEXT = "No past analysis context is available yet."


class QdrantService:
    def __init__(self) -> None:
        self._client = None
        self._embedding_model = None
        self._collection_ready = False

    @property
    def is_configured(self) -> bool:
        return bool(settings.qdrant_url and settings.qdrant_api_key)

    def _get_client(self):
        if not self.is_configured:
            return None

        if self._client is None:
            from qdrant_client import QdrantClient

            self._client = QdrantClient(
                url=settings.qdrant_url,
                api_key=settings.qdrant_api_key,
                timeout=30,
            )

        return self._client

    def _get_embedding_model(self):
        if self._embedding_model is None:
            from sentence_transformers import SentenceTransformer

            self._embedding_model = SentenceTransformer(
                settings.embedding_model,
                device="cpu",
                model_kwargs={"low_cpu_mem_usage": False},
            )
        return self._embedding_model

    async def _embed(self, text: str) -> list[float]:
        def run() -> list[float]:
            model = self._get_embedding_model()
            vector = model.encode(text, normalize_embeddings=True)
            return [float(value) for value in vector.tolist()]

        return await asyncio.to_thread(run)

    async def _ensure_collection(self) -> None:
        if self._collection_ready:
            return

        client = self._get_client()
        if client is None:
            return

        def run() -> None:
            from qdrant_client.http.exceptions import UnexpectedResponse
            from qdrant_client.models import Distance, VectorParams, PayloadSchemaType

            try:
                client.get_collection(settings.qdrant_collection)
            except UnexpectedResponse:
                client.create_collection(
                    collection_name=settings.qdrant_collection,
                    vectors_config=VectorParams(
                        size=settings.embedding_dimensions,
                        distance=Distance.COSINE,
                    ),
                )

            # Ensure payload index on session_id exists for filtering
            try:
                client.create_payload_index(
                    collection_name=settings.qdrant_collection,
                    field_name="session_id",
                    field_schema=PayloadSchemaType.KEYWORD,
                )
            except Exception as e:
                logger.warning("Failed to create payload index on session_id: %s", e)

        await asyncio.to_thread(run)
        self._collection_ready = True

    async def retrieve_context(self, *, session_id: str, job_description: str) -> str:
        client = self._get_client()
        if client is None:
            return DEFAULT_CONTEXT

        try:
            await self._ensure_collection()
            query_vector = await self._embed(job_description)

            def run():
                from qdrant_client.models import FieldCondition, Filter, MatchValue

                response = client.query_points(
                    collection_name=settings.qdrant_collection,
                    query=query_vector,
                    query_filter=Filter(
                        must=[
                            FieldCondition(
                                key="session_id",
                                match=MatchValue(value=session_id),
                            )
                        ]
                    ),
                    limit=3,
                    with_payload=True,
                )
                return response.points

            results = await asyncio.to_thread(run)
        except Exception as exc:
            logger.warning("Qdrant context retrieval failed: %s", exc)
            return DEFAULT_CONTEXT

        if not results:
            return DEFAULT_CONTEXT

        context_lines = []
        for point in results:
            payload = point.payload or {}
            tips = payload.get("improvement_tips") or []
            if isinstance(tips, list):
                tips_text = "; ".join(str(tip) for tip in tips[:3])
            else:
                tips_text = str(tips)

            context_lines.append(
                " | ".join(
                    [
                        f"Job: {payload.get('job_title', 'Unknown')}",
                        f"Score: {payload.get('match_score', 'n/a')}",
                        f"Tips: {tips_text or 'n/a'}",
                    ]
                )
            )

        return "\n".join(context_lines)

    async def upsert_analysis(
        self,
        *,
        session_id: str,
        result: AnalysisResult,
        parsed_resume: ParsedResume,
    ) -> str | None:
        client = self._get_client()
        if client is None:
            return None

        try:
            await self._ensure_collection()
            vector_text = build_vector_text(result=result, parsed_resume=parsed_resume)
            vector = await self._embed(vector_text)

            def run() -> None:
                from qdrant_client.models import PointStruct

                client.upsert(
                    collection_name=settings.qdrant_collection,
                    points=[
                        PointStruct(
                            id=result.analysis_id,
                            vector=vector,
                            payload={
                                "analysis_id": result.analysis_id,
                                "session_id": session_id,
                                "job_title": result.job_title,
                                "timestamp": result.timestamp.isoformat(),
                                "match_score": result.scores.overall,
                                "missing_skills": result.missing_skills,
                                "ats_keywords": result.ats_keywords,
                                "improvement_tips": result.improvement_tips,
                            },
                        )
                    ],
                )

            await asyncio.to_thread(run)
            return result.analysis_id
        except Exception as exc:
            logger.warning("Qdrant analysis upsert failed: %s", exc)
            return None

    async def delete_analysis(self, *, vector_id: str | None) -> bool:
        client = self._get_client()
        if client is None or not vector_id:
            return False

        try:
            def run() -> None:
                from qdrant_client.models import PointIdsList

                client.delete(
                    collection_name=settings.qdrant_collection,
                    points_selector=PointIdsList(points=[vector_id]),
                )

            await asyncio.to_thread(run)
            return True
        except Exception as exc:
            logger.warning("Qdrant vector delete failed: %s", exc)
            return False


def build_vector_text(*, result: AnalysisResult, parsed_resume: ParsedResume) -> str:
    summary = parsed_resume.sections.get("summary", parsed_resume.text[:500])
    return "\n".join(
        [
            result.job_title,
            "ATS keywords: " + ", ".join(result.ats_keywords),
            "Missing skills: " + ", ".join(result.missing_skills),
            "Resume summary: " + summary,
        ]
    )


qdrant_service = QdrantService()
