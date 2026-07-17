from fastapi import Header, HTTPException, status
from jose import jwt, JWTError
import httpx

from app.core.config import settings

# Cache Clerk's public keys (they don't change often)
_clerk_jwks = None


async def get_clerk_jwks() -> dict:
    global _clerk_jwks
    if _clerk_jwks is None:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://api.clerk.com/v1/jwks",
                headers={"Authorization": f"Bearer {settings.clerk_secret_key}"},
            )
            _clerk_jwks = resp.json()
    return _clerk_jwks


async def get_current_user(authorization: str = Header(...)) -> str:
    """
    Extract and verify Clerk JWT from Authorization header.
    Returns the user_id (Clerk's user ID, e.g. 'user_2abc123').
    Raises 401 if token is invalid or missing.
    """
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

        # Decode and verify the token
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )

        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User ID not found in token")

        return user_id

    except JWTError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {str(e)}")