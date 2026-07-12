from __future__ import annotations

import time
from collections import defaultdict
from threading import Lock

from app.core.config import settings


class _RateLimitInfo:
    __slots__ = ('requests', 'lock')

    def __init__(self) -> None:
        self.requests: list[float] = []
        self.lock = Lock()


_store: dict[str, _RateLimitInfo] = defaultdict(_RateLimitInfo)
_max_requests = settings.rate_limit_requests
_window_seconds = settings.rate_limit_window_seconds


def check_limit(session_id: str) -> tuple[bool, int, int]:
    """
    Check if the session has exceeded rate limit.

    Returns:
        tuple: (allowed, remaining_requests, retry_after_seconds)
    """
    now = time.time()
    window_start = now - _window_seconds

    info = _store[session_id]
    with info.lock:
        # Clean old requests outside the window
        info.requests = [ts for ts in info.requests if ts > window_start]

        if len(info.requests) >= _max_requests:
            # Rate limited - calculate retry after
            oldest = info.requests[0]
            retry_after = int(oldest + _window_seconds - now) + 1
            return False, 0, max(retry_after, 1)

        # Allow request
        info.requests.append(now)
        remaining = _max_requests - len(info.requests)
        return True, remaining, 0


def get_headers(session_id: str, allowed: bool, remaining: int, retry_after: int) -> dict[str, str]:
    """Generate rate limit headers."""
    headers = {
        "X-RateLimit-Limit": str(_max_requests),
        "X-RateLimit-Remaining": str(max(remaining, 0)),
        "X-RateLimit-Window": str(_window_seconds),
    }
    if not allowed:
        headers["Retry-After"] = str(retry_after)
    return headers