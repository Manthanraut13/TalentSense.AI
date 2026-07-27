from app.services.mongo_service import mongo_service
from bson import ObjectId
from datetime import datetime, timezone

def _get_resumes_collection():
    """Get the resumes collection from MongoDB."""
    db = mongo_service._get_collection().database
    return db.resumes

FREE_TIER_RESUME_LIMIT = 2
PRO_TIER_RESUME_LIMIT = 20

async def save_resume(user_id: str, name: str, content: str, is_pro: bool = False) -> dict:
    """Save a named resume version for a user."""
    limit = PRO_TIER_RESUME_LIMIT if is_pro else FREE_TIER_RESUME_LIMIT
    collection = _get_resumes_collection()
    count = await collection.count_documents({"user_id": user_id})

    if count >= limit:
        raise ValueError(
            f"Resume limit reached ({limit}). "
            + ("Delete an existing resume to add a new one."
               if is_pro else "Upgrade to Pro for up to 20 saved resumes.")
        )

    doc = {
        "user_id": user_id,
        "name": name[:60],           # Cap name length
        "content": content[:8000],   # Same as sanitizer max
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_used": None,
    }
    result = await collection.insert_one(doc)
    doc["resume_id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc

async def get_resumes(user_id: str) -> list[dict]:
    """Get all saved resumes for a user (without full content)."""
    collection = _get_resumes_collection()
    cursor = collection.find(
        {"user_id": user_id},
        {"content": 0}   # Exclude content from list — fetch individually
    ).sort("created_at", -1)

    results = []
    async for doc in cursor:
        doc["resume_id"] = str(doc.pop("_id"))
        results.append(doc)
    return results

async def get_resume_by_id(resume_id: str, user_id: str) -> dict | None:
    """Get a single resume with full content."""
    collection = _get_resumes_collection()
    try:
        doc = await collection.find_one({
            "_id": ObjectId(resume_id),
            "user_id": user_id,
        })
    except Exception:
        return None
    if doc:
        doc["resume_id"] = str(doc.pop("_id"))
    return doc

async def delete_resume(resume_id: str, user_id: str) -> bool:
    collection = _get_resumes_collection()
    try:
        result = await collection.delete_one({
            "_id": ObjectId(resume_id),
            "user_id": user_id,
        })
        return result.deleted_count == 1
    except Exception:
        return False

async def mark_resume_used(resume_id: str):
    """Update last_used timestamp when a resume is analyzed."""
    collection = _get_resumes_collection()
    try:
        await collection.update_one(
            {"_id": ObjectId(resume_id)},
            {"$set": {"last_used": datetime.now(timezone.utc).isoformat()}}
        )
    except Exception:
        pass
