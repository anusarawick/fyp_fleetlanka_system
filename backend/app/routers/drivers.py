from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import get_bearer_token, require_manager_profile
from app.schemas.drivers import (
    DriverAttentionInsights,
    DriverCleanupInsights,
    DriverCreate,
    DriverDispatchCoverage,
    DriverInsightBucket,
    DriverInsightsOut,
    DriverOut,
    DriverUpdate,
)
from app.services.supabase_client import get_supabase_client

router = APIRouter(prefix="/drivers", tags=["drivers"])


def _profile_with_email(admin_client, row: dict) -> dict:
    email = None
    try:
        user_resp = admin_client.auth.admin.get_user_by_id(row["id"])
        user = user_resp.user if user_resp else None
        email = getattr(user, "email", None)
    except Exception:
        email = None
    return {**row, "email": email}


def _derive_trip_status(trip: dict) -> str:
    status = trip.get("status")
    if isinstance(status, str) and status.strip():
        return status
    if trip.get("end_time"):
        return "completed"
    if trip.get("start_time"):
        return "in_progress"
    return "assigned"


def _is_active_driver(driver: dict) -> bool:
    return (driver.get("status") or "active") == "active"


def _driver_label(driver: dict) -> str:
    return driver.get("full_name") or driver.get("email") or driver.get("phone") or "Driver"


def _driver_bucket(drivers: List[dict]) -> DriverInsightBucket:
    return DriverInsightBucket(
        count=len(drivers),
        driver_ids=[driver["id"] for driver in drivers],
        preview=[_driver_label(driver) for driver in drivers[:3]],
    )


@router.get("", response_model=List[DriverOut])
def list_drivers(
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token)
) -> List[DriverOut]:
    org_id = profile["org_id"]
    admin_client = get_supabase_client(use_service_role=True)
    response = (
        admin_client.table("profiles")
        .select("id, org_id, role, status, full_name, phone")
        .eq("org_id", org_id)
        .eq("role", "driver")
        .execute()
    )
    return [_profile_with_email(admin_client, row) for row in (response.data or [])]


@router.get("/insights", response_model=DriverInsightsOut)
def get_driver_insights(
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token)
) -> DriverInsightsOut:
    org_id = profile["org_id"]
    admin_client = get_supabase_client(use_service_role=True)
    drivers_response = (
        admin_client.table("profiles")
        .select("id, org_id, role, status, full_name, phone")
        .eq("org_id", org_id)
        .eq("role", "driver")
        .execute()
    )
    drivers = [_profile_with_email(admin_client, row) for row in (drivers_response.data or [])]

    trips_response = (
        admin_client.table("trips")
        .select("driver_id, status, start_time, end_time")
        .eq("org_id", org_id)
        .execute()
    )
    current_driver_ids = {
        trip.get("driver_id")
        for trip in (trips_response.data or [])
        if trip.get("driver_id") and _derive_trip_status(trip) in {"assigned", "in_progress"}
    }

    missing_phone = [driver for driver in drivers if not driver.get("phone")]
    missing_email = [driver for driver in drivers if not driver.get("email")]
    inactive_access = [driver for driver in drivers if not _is_active_driver(driver)]
    active_drivers = [driver for driver in drivers if _is_active_driver(driver)]
    available_drivers = [driver for driver in active_drivers if driver["id"] not in current_driver_ids]
    contact_ready = [
        driver
        for driver in active_drivers
        if driver.get("email") and driver.get("phone")
    ]
    incomplete_profiles = [
        driver
        for driver in drivers
        if not driver.get("email") or not driver.get("phone")
    ]
    missing_names = [driver for driver in drivers if not driver.get("full_name")]

    return DriverInsightsOut(
        attention=DriverAttentionInsights(
            missing_phone=_driver_bucket(missing_phone),
            missing_email=_driver_bucket(missing_email),
            inactive_access=_driver_bucket(inactive_access),
        ),
        dispatch_coverage=DriverDispatchCoverage(
            available_drivers=len(available_drivers),
            assigned_now=len(current_driver_ids),
            contact_ready=len(contact_ready),
            active_total=len(active_drivers),
        ),
        cleanup=DriverCleanupInsights(
            incomplete_profiles=len(incomplete_profiles),
            missing_names=len(missing_names),
            disabled_accounts=len(inactive_access),
        ),
    )


@router.post("", response_model=DriverOut)
def create_driver(
    payload: DriverCreate, 
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token)
) -> DriverOut:
    org_id = profile["org_id"]
    admin_client = get_supabase_client(use_service_role=True)

    created_user = admin_client.auth.admin.create_user(
        {
            "email": payload.email,
            "password": payload.password,
            "email_confirm": True,
            "user_metadata": {
                "org_id": org_id,
                "role": "driver",
                "status": payload.status or "active",
                "full_name": payload.full_name,
                "phone": payload.phone,
            },
        }
    )
    user_id = created_user.user.id if created_user and created_user.user else None
    if not user_id:
        raise HTTPException(status_code=400, detail="Failed to create auth user")

    profile_resp = (
        admin_client.table("profiles")
        .select("id, org_id, role, status, full_name, phone")
        .eq("id", user_id)
        .single()
        .execute()
    )
    if not profile_resp.data:
        raise HTTPException(status_code=500, detail="Profile was not created")

    return _profile_with_email(admin_client, profile_resp.data)


@router.patch("/{driver_id}", response_model=DriverOut)
def update_driver(
    driver_id: str,
    payload: DriverUpdate,
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token),
) -> DriverOut:
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    admin_client = get_supabase_client(use_service_role=True)
    profile_updates = payload.model_dump(exclude_none=True, exclude={"email"})
    auth_updates = {}
    user_metadata = {}
    if payload.email is not None:
        auth_updates["email"] = payload.email
    if payload.password is not None:
        auth_updates["password"] = payload.password
    if payload.status is not None:
        user_metadata["status"] = payload.status
    if payload.full_name is not None:
        user_metadata["full_name"] = payload.full_name
    if payload.phone is not None:
        user_metadata["phone"] = payload.phone
    if user_metadata:
        auth_updates["user_metadata"] = user_metadata
    if auth_updates:
        try:
            admin_client.auth.admin.update_user_by_id(driver_id, auth_updates)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Driver auth update failed: {exc}")
    response = (
        admin_client.table("profiles")
        .update(profile_updates)
        .eq("id", driver_id)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=400, detail="Update failed")
    return _profile_with_email(admin_client, response.data[0])


@router.delete("/{driver_id}")
def delete_driver(
    driver_id: str,
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token)
) -> dict:
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    admin_client = get_supabase_client(use_service_role=True)
    # delete auth user (will cascade profile)
    admin_client.auth.admin.delete_user(driver_id)
    return {"status": "ok"}
