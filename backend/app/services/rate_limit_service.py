from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from app.services.mongo_service import mongo_service

logger = logging.getLogger(__name__)

DAILY_LIMIT = 5


def _today_utc() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _next_midnight_utc() -> str:
    now = datetime.now(timezone.utc)
    tomorrow = now.date() + timedelta(days=1)
    return datetime.combine(tomorrow, datetime.min.time(), tzinfo=timezone.utc).isoformat()


async def check_rate_limit(user_id: str, is_pro: bool = False) -> dict:
    """
    Check if user is within their rate limit.
    Returns { allowed: bool, used: int, limit: int, remaining: int }
    """
    if is_pro:
        return {"allowed": True, "used": 0, "limit": -1, "remaining": -1}

    collection = mongo_service._get_collection()
    if collection is None:
        return {"allowed": True, "used": 0, "limit": DAILY_LIMIT, "remaining": DAILY_LIMIT}

    # Use existing mongo_service indexes (already created in _ensure_indexes)
    today = _today_utc()

    from pymongo import ReturnDocument

    result = await collection.database.rate_limits.find_one_and_update(
        {"user_id": user_id, "date": today},
        {"$inc": {"count": 1}, "$setOnInsert": {"user_id": user_id, "date": today}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )

    count = result["count"] if result else 0
    remaining = max(0, DAILY_LIMIT - count)

    return {
        "allowed": count <= DAILY_LIMIT,
        "used": count,
        "limit": DAILY_LIMIT,
        "remaining": remaining,
        "reset_at": _next_midnight_utc(),
    }


async def get_usage_status(user_id: str, is_pro: bool = False) -> dict:
    """Return current user's daily usage stats without incrementing."""
    if is_pro:
        return {"used": 0, "limit": -1, "remaining": -1, "is_pro": True}

    collection = mongo_service._get_collection()
    if collection is None:
        return {"used": 0, "limit": DAILY_LIMIT, "remaining": DAILY_LIMIT, "is_pro": False}

    today = _today_utc()
    doc = await collection.database.rate_limits.find_one({"user_id": user_id, "date": today})
    count = doc["count"] if doc else 0
    remaining = max(0, DAILY_LIMIT - count)

    return {
        "used": count,
        "limit": DAILY_LIMIT,
        "remaining": remaining,
        "is_pro": False,
        "reset_at": _next_midnight_utc(),
    }
