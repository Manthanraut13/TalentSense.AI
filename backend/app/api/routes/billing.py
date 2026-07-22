from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.api.deps import get_current_user
from app.core.config import settings
from app.services.user_service import (
    downgrade_user_to_free,
    get_or_create_user,
    get_user_plan,
    set_stripe_customer_id,
    upgrade_user_to_pro,
)

router = APIRouter(prefix="/api/billing", tags=["billing"])


def _stripe():
    if not settings.stripe_secret_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe is not configured",
        )

    import stripe

    stripe.api_key = settings.stripe_secret_key
    return stripe


@router.post("/create-checkout-session")
async def create_checkout_session(request: Request, user_id: str = Depends(get_current_user)):
    if not settings.stripe_pro_price_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe Pro price ID is not configured",
        )

    stripe = _stripe()
    body = await request.json()
    success_url = body.get("success_url")
    cancel_url = body.get("cancel_url")
    if not success_url or not cancel_url:
        raise HTTPException(status_code=422, detail="success_url and cancel_url are required")

    user = await get_or_create_user(user_id, email=body.get("email", ""))
    customer_id = user.get("stripe_customer_id")

    session = stripe.checkout.Session.create(
        customer=customer_id or None,
        customer_email=None if customer_id else body.get("email"),
        payment_method_types=["card"],
        mode="subscription",
        line_items=[{"price": settings.stripe_pro_price_id, "quantity": 1}],
        success_url=f"{success_url}?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=cancel_url,
        metadata={"user_id": user_id},
    )

    return {"checkout_url": session.url}


@router.post("/webhook", include_in_schema=False)
async def stripe_webhook(request: Request):
    stripe = _stripe()
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid Stripe webhook") from exc

    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "checkout.session.completed":
        customer_id = data.get("customer")
        subscription_id = data.get("subscription")
        user_id = data.get("metadata", {}).get("user_id")
        if user_id and customer_id:
            await set_stripe_customer_id(user_id, customer_id)
        if customer_id:
            await upgrade_user_to_pro(customer_id, subscription_id)
    elif event_type == "customer.subscription.deleted":
        customer_id = data.get("customer")
        if customer_id:
            await downgrade_user_to_free(customer_id)

    return {"received": True}


@router.get("/status")
async def get_billing_status(user_id: str = Depends(get_current_user)):
    plan = await get_user_plan(user_id)
    return {"plan": plan, "is_pro": plan == "pro"}


@router.post("/cancel")
async def cancel_subscription(user_id: str = Depends(get_current_user)):
    stripe = _stripe()
    user = await get_or_create_user(user_id)
    subscription_id = user.get("stripe_subscription_id")
    if not subscription_id:
        raise HTTPException(status_code=400, detail="No active subscription found")

    stripe.Subscription.modify(subscription_id, cancel_at_period_end=True)
    return {"cancelled": True, "message": "Subscription will end at period end"}
