from app.services.payment_sync import mark_service_booking_payment_paid


def test_mark_service_booking_payment_paid_updates_rows_and_notifies_recipients(fake_supabase) -> None:
    fake_supabase.tables["service_booking_payments"] = [
        {"id": "payment-1", "booking_id": "booking-1", "org_id": "org-1", "status": "pending"}
    ]
    fake_supabase.tables["service_bookings"] = [
        {
            "id": "booking-1",
            "org_id": "org-1",
            "center_id": "center-1",
            "vehicle_id": "vehicle-1",
            "payment_status": "pending",
            "final_cost_lkr": 25000,
        }
    ]

    mark_service_booking_payment_paid(
        fake_supabase,
        payment_id="payment-1",
        booking_id="booking-1",
        org_id="org-1",
        payment_intent_id="pi_123",
    )

    assert fake_supabase.tables["service_booking_payments"][0]["status"] == "paid"
    assert fake_supabase.tables["service_booking_payments"][0]["stripe_payment_intent_id"] == "pi_123"
    assert fake_supabase.tables["service_bookings"][0]["payment_status"] == "paid"
    alert_titles = {row["title"] for row in fake_supabase.tables["alerts"]}
    assert "Service payment completed" in alert_titles
    assert "Service payment received" in alert_titles
