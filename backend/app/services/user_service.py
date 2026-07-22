from __future__ import annotations

from datetime import datetime, timezone

from app.services.mongo_service import mongo_service


def _users_collection():
    collection = mongo_service._get_collection()
    if collection is None:
        return None
    return collection.database.users


async def get_or_create_user(user_id: str, email: str = "") -> dict:
    collection = _users_collection()
    if collection is None:
        return {
            "user_id": user_id,
            "email": email,
            "plan": "free",
            "stripe_customer_id": None,
            "stripe_subscription_id": None,
        }

    user = await collection.find_one({"user_id": user_id}, {"_id": 0})
    if user:
        return user

    user = {
        "user_id": user_id,
        "email": email,
        "plan": "free",
        "stripe_customer_id": None,
        "stripe_subscription_id": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await collection.insert_one(user)
    user.pop("_id", None)
    return user


async def get_user_plan(user_id: str) -> str:
    collection = _users_collection()
    if collection is None:
        return "free"

    user = await collection.find_one({"user_id": user_id}, {"plan": 1})
    return user.get("plan", "free") if user else "free"


async def upgrade_user_to_pro(stripe_customer_id: str, subscription_id: str | None) -> None:
    collection = _users_collection()
    if collection is None:
        return

    await collection.update_one(
        {"stripe_customer_id": stripe_customer_id},
        {"$set": {"plan": "pro", "stripe_subscription_id": subscription_id}},
    )


async def downgrade_user_to_free(stripe_customer_id: str) -> None:
    collection = _users_collection()
    if collection is None:
        return

    await collection.update_one(
        {"stripe_customer_id": stripe_customer_id},
        {"$set": {"plan": "free", "stripe_subscription_id": None}},
    )


async def set_stripe_customer_id(user_id: str, customer_id: str) -> None:
    collection = _users_collection()
    if collection is None:
        return

    await collection.update_one(
        {"user_id": user_id},
        {"$set": {"stripe_customer_id": customer_id}},
        upsert=True,
    )
