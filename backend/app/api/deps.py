import logging

from fastapi import Depends, Header, HTTPException, Request, status
from jose import jwt, JWTError
import httpx
from datetime import datetime, timezone

from app.core.config import settings
from app.services.rate_limit_service import check_rate_limit

logger = logging.getLogger(__name__)

# Cache Clerk's public keys (they don't change often)
_clerk_jwks = None
_clerk_jwks_fetched_at: float = 0
CLERK_JWKS_TTL = 3600  # refresh every hour


async def get_clerk_jwks() -> dict:
    global _clerk_jwks, _clerk_jwks_fetched_at
    import time

    now = time.time()
    if _clerk_jwks is not None and (now - _clerk_jwks_fetched_at) < CLERK_JWKS_TTL:
        return _clerk_jwks

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(
                "https://api.clerk.com/v1/jwks",
                headers={"Authorization": f"Bearer {settings.clerk_secret_key}"},
            )
            resp.raise_for_status()
            _clerk_jwks = resp.json()
            _clerk_jwks_fetched_at = now
            logger.info("Clerk JWKS refreshed successfully")
    except httpx.TimeoutException:
        logger.error("Clerk JWKS fetch timed out — Clerk API unreachable")
        if _clerk_jwks is not None:
            return _clerk_jwks  # serve stale cache
        raise
    except Exception as e:
        logger.error("Clerk JWKS fetch failed: %s", e)
        if _clerk_jwks is not None:
            return _clerk_jwks  # serve stale cache
        raise

    return _clerk_jwks


async def get_current_user(authorization: str = Header(...)) -> str:
    """
    Extract and verify Clerk JWT from Authorization header.
    Returns the user_id (Clerk's user ID, e.g. 'user_2abc123').
    Raises 401 if token is invalid or missing.
    """
    # Test mode: bypass auth with a test user
    if settings.test_mode:
        logger.info("test_mode active — returning test_user_123")
        return "test_user_123"

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authorization header format")

    token = authorization.split(" ")[1]

    try:
        # Decode without verification first to get the kid (key ID)
        unverified_header = jwt.get_unverified_header(token)
        jwks = await get_clerk_jwks()

        # Find the matching public key
        public_key = None
        for key in jwks.get("keys", []):
            if key.get("kid") == unverified_header.get("kid"):
                public_key = key
                break

        if not public_key:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unable to find matching public key")

        logger.info("Token: %s...", token[:30])
        logger.info("Header: %s", unverified_header)

        claims = jwt.get_unverified_claims(token)

        logger.debug("Token iat=%s nbf=%s exp=%s",
                      datetime.fromtimestamp(claims["iat"], timezone.utc),
                      datetime.fromtimestamp(claims["nbf"], timezone.utc),
                      datetime.fromtimestamp(claims["exp"], timezone.utc))

        # Decode and verify the token
        key = jwks.get("keys")[0]  # Use first key for RS256
        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            options={
                "verify_aud": False,
                "leeway": 30,
            },
        )

        logger.info("Payload: %s", payload)

        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User ID not found in token")

        return user_id

    except JWTError as e:
        logger.exception("JWT verification failed")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        )


async def enforce_rate_limit(request: Request, user_id: str = Depends(get_current_user)) -> str:
    """
    Shared dependency: check the user's daily action limit before expensive work.
    Raises 429 when the limit is exceeded, and records the rate status on the
    request so routes can emit X-RateLimit-* headers.
    """
    rate_status = await check_rate_limit(user_id)
    if not rate_status["allowed"]:
        logger.warning("Rate limit exceeded: user=%s, used=%s/%s",
                       user_id, rate_status["used"], rate_status["limit"])
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "message": "Daily analysis limit reached. Please try again tomorrow.",
                "used": rate_status["used"],
                "limit": rate_status["limit"],
                "resets": "midnight UTC",
            },
        )
    request.state.rate_limit_info = rate_status
    return user_id
