from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import stripe

from app.core.config import settings
from app.services.notifications import manager_profiles, notify_profiles, service_profile_for_center, upsert_notification


def _can_sync_stripe() -> bool:
    if not settings.stripe_secret_key:
        return False
    stripe.api_key = settings.stripe_secret_key
    return True


def mark_service_booking_payment_paid(
    admin_client: Any,
    *,
    payment_id: str,
    booking_id: str,
    org_id: str,
    payment_intent_id: str | None = None,
) -> None:
    paid_at = datetime.now(timezone.utc).isoformat()
    admin_client.table("service_booking_payments").update(
        {
            "status": "paid",
            "stripe_payment_intent_id": payment_intent_id,
            "paid_at": paid_at,
        }
    ).eq("id", payment_id).eq("booking_id", booking_id).eq("org_id", org_id).execute()
    admin_client.table("service_bookings").update(
        {"payment_status": "paid"}
    ).eq("id", booking_id).eq("org_id", org_id).execute()
    booking_resp = (
        admin_client.table("service_bookings")
        .select("id, center_id, vehicle_id, final_cost_lkr")
        .eq("id", booking_id)
        .eq("org_id", org_id)
        .single()
        .execute()
    )
    booking = booking_resp.data or {}
    notify_profiles(
        admin_client,
        manager_profiles(admin_client, org_id),
        org_id=org_id,
        source_key=f"event:payment:{payment_id}:paid:manager",
        alert_type="payment_paid",
        title="Service payment completed",
        message="A service booking payment was completed.",
        severity="success",
        category="payments",
        action_url="/maintenance",
        related_entity="service_bookings",
        related_id=booking_id,
        source_table="service_booking_payments",
        source_id=payment_id,
        metadata={"booking_id": booking_id, "amount_lkr": booking.get("final_cost_lkr")},
    )
    service_profile = service_profile_for_center(admin_client, booking.get("center_id"), org_id)
    if service_profile:
        upsert_notification(
            admin_client,
            org_id=org_id,
            recipient_profile_id=service_profile["id"],
            source_key=f"event:payment:{payment_id}:paid:service",
            alert_type="payment_paid",
            title="Service payment received",
            message="A manager payment for a service booking was completed.",
            severity="success",
            category="payments",
            action_url="/service/bookings",
            related_entity="service_bookings",
            related_id=booking_id,
            source_table="service_booking_payments",
            source_id=payment_id,
            metadata={"booking_id": booking_id, "amount_lkr": booking.get("final_cost_lkr")},
        )


def reconcile_service_booking_payments(admin_client: Any, org_id: str) -> None:
    if not _can_sync_stripe():
        return
    payments = (
        admin_client.table("service_booking_payments")
        .select("id, booking_id, org_id, stripe_checkout_session_id")
        .eq("org_id", org_id)
        .eq("status", "pending")
        .execute()
        .data
        or []
    )
    for payment in payments:
        session_id = payment.get("stripe_checkout_session_id")
        booking_id = payment.get("booking_id")
        payment_id = payment.get("id")
        if not session_id or not booking_id or not payment_id:
            continue
        try:
            session = stripe.checkout.Session.retrieve(session_id)
        except Exception:
            continue
        if session.get("payment_status") == "paid":
            mark_service_booking_payment_paid(
                admin_client,
                payment_id=payment_id,
                booking_id=booking_id,
                org_id=org_id,
                payment_intent_id=session.get("payment_intent"),
            )
