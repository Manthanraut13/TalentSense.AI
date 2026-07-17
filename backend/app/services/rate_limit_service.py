from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

DAILY_LIMIT = 5


@dataclass(frozen=True)
class RateLimitStatus:
    used: int
    limit: int
    remaining: int
    is_pro: bool = False
    reset_at: Optional[datetime] = None


class RateLimitService:
    def __init__(self) -> None:
        self._client = None
        self._collection = None

    def _get_collection(self):
        if not settings.mongodb_uri:
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
                self._collection = database["rate_limits"]
                logger.info("Rate limit collection ready")
            except Exception as e:
                logger.error(f"Failed to connect to MongoDB for rate limits: {e}")
                return None

        return self._collection

    async def _ensure_indexes(self) -> None:
        collection = self._get_collection()
        if collection is None:
            return

        await collection.create_index(
            [("user_id", 1), ("date", 1)],
            unique=True,
            name="user_date_unique"
        )

    async def check_limit(self, user_id: str, is_pro: bool = False) -> dict:
        """
        Check if user is within their rate limit.
        Returns { allowed: bool, used: int, limit: int, remaining: int }
        Increments counter on every call (for analyze endpoint).
        """
        if is_pro:
            return {"allowed": True, "used": 0, "limit": -1, "remaining": -1}

        collection = self._get_collection()
        if collection is None:
            return {"allowed": True, "used": 0, "limit": DAILY_LIMIT, "remaining": DAILY_LIMIT}

        await self._ensure_indexes()
        today = date.today()

        from pymongo import ReturnDocument

        result = await collection.find_one_and_update(
            {"user_id": user_id, "date": today.isoformat()},
            {"$inc": {"count": 1}, "$setOnInsert": {"user_id": user_id, "date": today.isoformat()}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )

        count = result["count"] if result else 0
        remaining = max(0, DAILY_LIMIT - count)

        return {
            "allowed": count < DAILY_LIMIT,
            "used": count,
            "limit": DAILY_LIMIT,
            "remaining": remaining,
        }

    async def get_status(self, user_id: str, is_pro: bool = False) -> RateLimitStatus:
        """Get current usage without incrementing (for /usage endpoint)."""
        collection = self._get_collection()
        if collection is None:
            return RateLimitStatus(used=0, limit=DAILY_LIMIT, remaining=DAILY_LIMIT, is_pro=is_pro)

        await self._ensure_indexes()
        today = date.today()

        doc = await collection.find_one({"user_id": user_id, "date": today.isoformat()})
        count = doc["count"] if doc else 0
        remaining = max(0, DAILY_LIMIT - count)

        reset_at = datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc)

        return RateLimitStatus(
            used=count,
            limit=DAILY_LIMIT,
            remaining=remaining,
            is_pro=is_pro,
            reset_at=reset_at
        )


rate_limit_service = RateLimitService()


async def check_rate_limit(user_id: str, is_pro: bool = False) -> dict:
    """Public function to check rate limit (increments counter)."""
    return await rate_limit_service.check_limit(user_id, is_pro)


async def get_usage_status(user_id: str, is_pro: bool = False) -> RateLimitStatus:
    """Public function to get usage status (no increment)."""
    return await rate_limit_service.get_status(user_id, is_pro)