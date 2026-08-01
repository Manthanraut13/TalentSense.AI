from __future__ import annotations

import logging
from datetime import date

from app.core.config import settings
from app.services import rate_limiter
from app.services.mongo_service import mongo_service

logger = logging.getLogger(__name__)


def _rate_limits_collection():
    collection = mongo_service._get_collection()
    if collection is None:
        return None
    return collection.database.rate_limits


async def get_usage_today(user_id: str) -> int:
    """Return how many actions this user has taken today (UTC)."""
    collection = _rate_limits_collection()
    if collection is None:
        return 0
    today = date.today().isoformat()
    try:
        doc = await collection.find_one({"user_id": user_id, "date": today}, {"count": 1})
        return doc["count"] if doc else 0
    except Exception as exc:
        logger.warning("Rate limit usage lookup failed: %s", exc)
        return 0


async def increment_usage(user_id: str, count: int = 1) -> int:
    """Increment today's usage count. Returns the new count."""
    collection = _rate_limits_collection()
    if collection is None:
        return rate_limiter.consume(user_id)
    today = date.today().isoformat()
    try:
        result = await collection.find_one_and_update(
            {"user_id": user_id, "date": today},
            {"$inc": {"count": count}},
            upsert=True,
            return_document=True,
        )
        return result["count"] if result else 0
    except Exception as exc:
        logger.warning("Rate limit increment failed: %s", exc)
        return 0


async def check_rate_limit(user_id: str) -> dict:
    """
    Check if the user is within their daily action limit.

    The Pro plan is on hold, so every user gets `settings.rate_limit_requests`
    actions per day (UTC). Falls back to an in-memory limiter when MongoDB
    is unavailable.
    """
    limit = settings.rate_limit_requests
    collection = _rate_limits_collection()
    if collection is None:
        allowed, remaining, _retry_after = rate_limiter.peek_limit(user_id)
        return {
            "allowed": allowed,
            "used": max(0, limit - remaining),
            "limit": limit,
            "remaining": remaining,
        }

    used = await get_usage_today(user_id)
    remaining = max(0, limit - used)
    return {
        "allowed": used < limit,
        "used": used,
        "limit": limit,
        "remaining": remaining,
    }
