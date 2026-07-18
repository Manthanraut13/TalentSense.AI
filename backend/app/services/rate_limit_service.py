from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Optional

from app.core.config import settings
from app.services.mongo_service import mongo_service

logger = logging.getLogger(__name__)

DAILY_LIMIT = 5


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
    today = date.today()

    from pymongo import ReturnDocument

    result = await collection.database.rate_limits.find_one_and_update(
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


async def get_usage_status(user_id: str, is_pro: bool = False) -> dict:
    """Return current user's daily usage stats without incrementing."""
    if is_pro:
        return {"used": 0, "limit": -1, "remaining": -1, "is_pro": True}

    collection = mongo_service._get_collection()
    if collection is None:
        return {"used": 0, "limit": DAILY_LIMIT, "remaining": DAILY_LIMIT, "is_pro": False}

    today = date.today()
    doc = await collection.database.rate_limits.find_one({"user_id": user_id, "date": today.isoformat()})
    count = doc["count"] if doc else 0
    remaining = max(0, DAILY_LIMIT - count)

    reset_at = datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc)

    return {
        "used": count,
        "limit": DAILY_LIMIT,
        "remaining": remaining,
        "is_pro": False,
        "reset_at": reset_at.isoformat() if reset_at else None,
    }
