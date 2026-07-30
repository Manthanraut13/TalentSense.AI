import logging

logger = logging.getLogger(__name__)


async def check_rate_limit(user_id: str, is_pro: bool = False) -> dict:
    logger.debug("Rate limit check: user=%s (always allowed — unlimited tier)", user_id)
    return {"allowed": True, "used": 0, "limit": -1, "remaining": -1}


async def get_usage_status(user_id: str, is_pro: bool = False) -> dict:
    return {"used": 0, "limit": -1, "remaining": -1, "is_pro": True}
