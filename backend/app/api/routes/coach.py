import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.services.coach_agent import chat_with_coach

logger = logging.getLogger(__name__)

router = APIRouter(tags=["coach"])


class CoachMessageRequest(BaseModel):
    message: str
    conversation_id: str | None = None


@router.post("/coach/chat")
async def send_coach_message(
    body: CoachMessageRequest,
    user_id: str = Depends(get_current_user),
) -> dict:
    """Send a message to the AI career coach."""
    message = body.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    if len(message) > 1000:
        raise HTTPException(status_code=400, detail="Message too long (max 1000 characters)")

    conversation_id = body.conversation_id or str(uuid.uuid4())

    response = await chat_with_coach(
        user_id=user_id,
        message=message,
        conversation_id=conversation_id,
    )

    return {
        "response": response,
        "conversation_id": conversation_id,
    }
