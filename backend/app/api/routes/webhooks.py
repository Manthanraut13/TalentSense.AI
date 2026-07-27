from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse

from app.api.deps import get_current_user
from app.services.email_service import send_welcome_email
from app.services.user_service import get_or_create_user
import json

router = APIRouter()

@router.post("/webhooks/clerk", include_in_schema=False)
async def clerk_webhook(request: Request):
    """Handle Clerk webhook events (user.created)."""
    # In production, verify Clerk webhook signature here
    body = await request.json()

    if body.get("type") == "user.created":
        data = body.get("data", {})
        user_id = data.get("id")
        email = data.get("email_addresses", [{}])[0].get("email_address", "")
        first_name = data.get("first_name") or "there"

        await get_or_create_user(user_id, email)
        await send_welcome_email(email, first_name)

    return {"received": True}
