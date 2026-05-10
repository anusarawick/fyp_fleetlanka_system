from __future__ import annotations

from typing import Any, Optional

import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel

from app.core.config import settings
from app.core.deps import (
    get_current_service_center,
    require_manager_profile,
    require_service_profile,
)
from app.services.payment_sync import mark_service_booking_payment_paid
from app.services.supabase_client import get_supabase_client

router = APIRouter(tags=["payments"])


class StripeAccountStatusOut(BaseModel):
    payment_access_enabled: bool
    stripe_account_id: Optional[str] = None
    stripe_onboarding_status: str


class StripeOnboardingLinkOut(BaseModel):
    url: str


class CheckoutSessionOut(BaseModel):
    checkout_url: str


def _stripe_key() -> str:
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=500, detail="STRIPE_SECRET_KEY is not set")
    stripe.api_key = settings.stripe_secret_key
    return settings.stripe_secret_key


def _frontend_url() -> str:
    return settings.frontend_url.rstrip("/") or "http://localhost:5173"


def _amount_to_minor_units(amount: Any) -> int:
    try:
        value = float(amount)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Final cost is required before payment")
    if value <= 0:
        raise HTTPException(status_code=400, detail="Final cost must be greater than zero")
    return int(round(value * 100))


def _account_status(account: Any) -> str:
    if getattr(account, "details_submitted", False) and getattr(account, "charges_enabled", False):
        return "connected"
    if getattr(account, "details_submitted", False):
        return "pending_verification"
    return "onboarding_pending"


def _sync_center_account_status(admin_client: Any, center: dict) -> dict:
    account_id = center.get("stripe_account_id")
    if not account_id:
        return center
    _stripe_key()
    account = stripe.Account.retrieve(account_id)
    status = _account_status(account)
    response = (
        admin_client.table("service_centers")
        .update({"stripe_onboarding_status": status})
        .eq("id", center["id"])
        .execute()
    )
    if response.data:
        return response.data[0]
    return {**center, "stripe_onboarding_status": status}


def _get_manager_email(admin_client: Any, profile_id: str) -> str | None:
    try:
        user = admin_client.auth.admin.get_user_by_id(profile_id)
        return getattr(user.user, "email", None)
    except Exception:
        return None


def _get_or_create_org_stripe_customer(admin_client: Any, profile: dict) -> str:
    org_resp = (
        admin_client.table("organizations")
        .select("id,name,stripe_customer_id")
        .eq("id", profile["org_id"])
        .single()
        .execute()
    )
    org = org_resp.data
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if org.get("stripe_customer_id"):
        return org["stripe_customer_id"]

    manager_email = _get_manager_email(admin_client, profile["id"])
    org_name = (org.get("name") or "FleetLanka Organization").strip()
    manager_name = (profile.get("full_name") or "").strip()
    customer_payload: dict[str, Any] = {
        "name": org_name,
        "metadata": {
            "org_id": profile["org_id"],
            "org_name": org_name,
            "manager_profile_id": profile["id"],
        },
    }
    if manager_email:
        customer_payload["email"] = manager_email
    if manager_name:
        customer_payload["description"] = f"FleetLanka billing contact: {manager_name}"

    customer = stripe.Customer.create(**customer_payload)
    update_resp = (
        admin_client.table("organizations")
        .update({"stripe_customer_id": customer.id})
        .eq("id", profile["org_id"])
        .execute()
    )
    if not update_resp.data:
        raise HTTPException(status_code=500, detail="Failed to save organization Stripe customer")
    return customer.id


@router.post("/service-portal/payments/connect-account", response_model=StripeAccountStatusOut)
def connect_service_center_account(
    profile: dict = Depends(require_service_profile),
    center: dict = Depends(get_current_service_center),
) -> StripeAccountStatusOut:
    if not center.get("payment_access_enabled"):
        raise HTTPException(status_code=403, detail="Payment access is not enabled for this service center")
    _stripe_key()
    admin_client = get_supabase_client(use_service_role=True)

    if center.get("stripe_account_id"):
        synced = _sync_center_account_status(admin_client, center)
        return synced

    account_payload = {
        "type": "express",
        "country": settings.stripe_connected_account_country or "US",
        "capabilities": {
            "card_payments": {"requested": True},
            "transfers": {"requested": True},
        },
        "metadata": {
            "service_center_id": center["id"],
            "org_id": center["org_id"],
        },
    }
    account = stripe.Account.create(**account_payload)
    response = (
        admin_client.table("service_centers")
        .update({
            "stripe_account_id": account.id,
            "stripe_onboarding_status": _account_status(account),
        })
        .eq("id", center["id"])
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=400, detail="Failed to save Stripe account")
    return response.data[0]


@router.get("/service-portal/payments/account-status", response_model=StripeAccountStatusOut)
def get_service_center_payment_status(
    center: dict = Depends(get_current_service_center),
) -> StripeAccountStatusOut:
    if center.get("stripe_account_id"):
        admin_client = get_supabase_client(use_service_role=True)
        center = _sync_center_account_status(admin_client, center)
    return center


@router.post("/service-portal/payments/onboarding-link", response_model=StripeOnboardingLinkOut)
def create_service_center_onboarding_link(
    center: dict = Depends(get_current_service_center),
) -> StripeOnboardingLinkOut:
    if not center.get("payment_access_enabled"):
        raise HTTPException(status_code=403, detail="Payment access is not enabled for this service center")
    if not center.get("stripe_account_id"):
        raise HTTPException(status_code=400, detail="Create a Stripe account before onboarding")
    _stripe_key()
    admin_client = get_supabase_client(use_service_role=True)
    synced = _sync_center_account_status(admin_client, center)
    if synced.get("stripe_onboarding_status") == "connected":
        raise HTTPException(status_code=400, detail="Stripe payments are already connected")

    base_url = _frontend_url()
    link = stripe.AccountLink.create(
        account=synced["stripe_account_id"],
        refresh_url=f"{base_url}/profile?stripe_onboarding=refresh",
        return_url=f"{base_url}/profile?stripe_onboarding=return",
        type="account_onboarding",
    )
    return {"url": link.url}


@router.post("/payments/service-bookings/{booking_id}/checkout", response_model=CheckoutSessionOut)
def create_service_booking_checkout(
    booking_id: str,
    profile: dict = Depends(require_manager_profile),
) -> CheckoutSessionOut:
    _stripe_key()
    admin_client = get_supabase_client(use_service_role=True)
    booking_resp = (
        admin_client.table("service_bookings")
        .select("*")
        .eq("id", booking_id)
        .eq("org_id", profile["org_id"])
        .single()
        .execute()
    )
    booking = booking_resp.data
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if (booking.get("status") or "pending") != "completed":
        raise HTTPException(status_code=400, detail="Only completed bookings can be paid")
    if (booking.get("completion_review_status") or "pending") != "approved":
        raise HTTPException(status_code=400, detail="Booking must be approved before payment")
    if (booking.get("payment_status") or "unpaid") == "paid":
        raise HTTPException(status_code=400, detail="Booking is already paid")

    center_resp = (
        admin_client.table("service_centers")
        .select("*")
        .eq("id", booking["center_id"])
        .eq("org_id", profile["org_id"])
        .single()
        .execute()
    )
    center = center_resp.data
    if not center:
        raise HTTPException(status_code=404, detail="Service center not found")
    if not center.get("payment_access_enabled"):
        raise HTTPException(status_code=400, detail="Payment access is not enabled for this service center")
    if not center.get("stripe_account_id"):
        raise HTTPException(status_code=400, detail="Service center has not connected Stripe payments")

    synced_center = _sync_center_account_status(admin_client, center)
    if synced_center.get("stripe_onboarding_status") != "connected":
        raise HTTPException(status_code=400, detail="Service center Stripe onboarding is not complete")

    amount_minor = _amount_to_minor_units(booking.get("final_cost_lkr"))
    stripe_customer_id = _get_or_create_org_stripe_customer(admin_client, profile)
    payment_resp = (
        admin_client.table("service_booking_payments")
        .insert({
            "org_id": profile["org_id"],
            "booking_id": booking_id,
            "service_center_id": booking["center_id"],
            "amount_lkr": booking["final_cost_lkr"],
            "currency": "lkr",
            "status": "pending",
            "stripe_transfer_destination": synced_center["stripe_account_id"],
        })
        .execute()
    )
    if not payment_resp.data:
        raise HTTPException(status_code=400, detail="Failed to create payment record")
    payment = payment_resp.data[0]
    base_url = _frontend_url()
    session = stripe.checkout.Session.create(
        mode="payment",
        customer=stripe_customer_id,
        line_items=[
            {
                "price_data": {
                    "currency": "lkr",
                    "product_data": {
                        "name": f"Service booking {booking_id}",
                    },
                    "unit_amount": amount_minor,
                },
                "quantity": 1,
            }
        ],
        payment_intent_data={
            "transfer_data": {
                "destination": synced_center["stripe_account_id"],
            },
        },
        saved_payment_method_options={
            "payment_method_save": "enabled",
        },
        metadata={
            "booking_id": booking_id,
            "org_id": profile["org_id"],
            "service_center_id": booking["center_id"],
            "payment_id": payment["id"],
        },
        success_url=f"{base_url}/maintenance?payment=success&booking_id={booking_id}",
        cancel_url=f"{base_url}/maintenance?payment=cancelled&booking_id={booking_id}",
    )
    admin_client.table("service_booking_payments").update(
        {
            "stripe_checkout_session_id": session.id,
            "checkout_url": session.url,
        }
    ).eq("id", payment["id"]).execute()
    return {"checkout_url": session.url}


@router.post("/payments/stripe/webhook")
async def handle_stripe_webhook(
    request: Request,
    stripe_signature: Optional[str] = Header(None),
) -> dict:
    if not settings.stripe_webhook_secret:
        raise HTTPException(status_code=500, detail="STRIPE_WEBHOOK_SECRET is not set")
    payload = await request.body()
    try:
        event = stripe.Webhook.construct_event(
            payload,
            stripe_signature,
            settings.stripe_webhook_secret,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid payload") from exc
    except stripe.error.SignatureVerificationError as exc:
        raise HTTPException(status_code=400, detail="Invalid signature") from exc

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        metadata = session.get("metadata") or {}
        payment_id = metadata.get("payment_id")
        booking_id = metadata.get("booking_id")
        org_id = metadata.get("org_id")
        if payment_id and booking_id and org_id:
            admin_client = get_supabase_client(use_service_role=True)
            mark_service_booking_payment_paid(
                admin_client,
                payment_id=payment_id,
                booking_id=booking_id,
                org_id=org_id,
                payment_intent_id=session.get("payment_intent"),
            )

    return {"received": True}
