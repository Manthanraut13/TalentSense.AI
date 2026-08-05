import logging
from datetime import datetime, timezone

from bson import ObjectId

from app.services.mongo_service import mongo_service

logger = logging.getLogger(__name__)

APPLICATION_STATUSES = [
    "saved",
    "applied",
    "phone_screen",
    "technical",
    "final_round",
    "offer",
    "rejected",
]


def _applications_collection():
    """Return the job_applications collection, or None if MongoDB is unavailable."""
    collection = mongo_service._get_collection()
    if collection is None:
        return None
    return collection.database.job_applications


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _public_doc(doc: dict) -> dict:
    doc["application_id"] = str(doc.pop("_id"))
    return doc


async def create_application(user_id: str, data: dict) -> dict | None:
    """Create a new job application entry."""
    collection = _applications_collection()
    if collection is None:
        return None

    status = data.get("status", "saved")
    doc = {
        "user_id": user_id,
        "company": data.get("company", ""),
        "role": data.get("role", ""),
        "job_url": data.get("job_url", ""),
        "status": status,
        "analysis_id": data.get("analysis_id"),
        "match_score": data.get("match_score"),
        "notes": data.get("notes", ""),
        "applied_date": data.get("applied_date"),
        "created_at": _now(),
        "updated_at": _now(),
        "status_history": [
            {
                "status": status,
                "changed_at": _now(),
            }
        ],
    }
    result = await collection.insert_one(doc)
    doc["application_id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


async def get_applications(user_id: str) -> list[dict]:
    """Get all applications for a user, sorted by updated_at (newest first)."""
    collection = _applications_collection()
    if collection is None:
        return []

    cursor = collection.find({"user_id": user_id}).sort("updated_at", -1)

    results = []
    async for doc in cursor:
        results.append(_public_doc(doc))
    return results


async def update_application_status(
    application_id: str,
    user_id: str,
    new_status: str,
    notes: str | None = None,
) -> dict | None:
    """Update status and append to status history."""
    collection = _applications_collection()
    if collection is None:
        return None

    if new_status not in APPLICATION_STATUSES:
        raise ValueError(f"Invalid status: {new_status}")

    now = _now()
    update_fields = {
        "status": new_status,
        "updated_at": now,
    }
    if notes is not None:
        update_fields["notes"] = notes

    result = await collection.find_one_and_update(
        {"_id": ObjectId(application_id), "user_id": user_id},
        {
            "$set": update_fields,
            "$push": {
                "status_history": {
                    "status": new_status,
                    "changed_at": now,
                }
            },
        },
        return_document=True,
    )
    if result:
        return _public_doc(result)
    return None


async def update_application(
    application_id: str,
    user_id: str,
    update_data: dict,
) -> dict | None:
    """Update any fields on an application."""
    collection = _applications_collection()
    if collection is None:
        return None

    update_data["updated_at"] = _now()
    update_data.pop("_id", None)
    update_data.pop("user_id", None)

    result = await collection.find_one_and_update(
        {"_id": ObjectId(application_id), "user_id": user_id},
        {"$set": update_data},
        return_document=True,
    )
    if result:
        return _public_doc(result)
    return None


async def delete_application(application_id: str, user_id: str) -> bool:
    collection = _applications_collection()
    if collection is None:
        return False

    result = await collection.delete_one(
        {"_id": ObjectId(application_id), "user_id": user_id}
    )
    return result.deleted_count == 1
