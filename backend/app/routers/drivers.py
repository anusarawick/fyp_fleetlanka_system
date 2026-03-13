from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import get_bearer_token, require_manager_profile
from app.schemas.drivers import DriverCreate, DriverOut, DriverUpdate
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
    if payload.email is not None:
        try:
            admin_client.auth.admin.update_user_by_id(
                driver_id,
                {
                    "email": payload.email,
                    "user_metadata": {
                        "status": payload.status,
                        "full_name": payload.full_name,
                        "phone": payload.phone,
                    },
                },
            )
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Email update failed: {exc}")
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
