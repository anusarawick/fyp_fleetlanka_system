from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import get_bearer_token, require_manager_profile
from app.schemas.service_centers import (
    ServiceCenterCreate,
    ServiceCenterOut,
    ServiceCenterUpdate,
)
from app.services.supabase_client import get_supabase_client

router = APIRouter(prefix="/service-centers", tags=["service-centers"])


def _require_token(token: Optional[str]) -> str:
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    return token


def _center_with_portal(row: dict) -> dict:
    return row


@router.get("", response_model=List[ServiceCenterOut])
def list_centers(
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token),
) -> List[ServiceCenterOut]:
    token = _require_token(token)
    supabase = get_supabase_client(token)
    response = supabase.table("service_centers").select("*").execute()
    return [_center_with_portal(row) for row in (response.data or [])]


@router.post("", response_model=ServiceCenterOut)
def create_center(
    payload: ServiceCenterCreate,
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token)
) -> ServiceCenterOut:
    token = _require_token(token)
    org_id = profile["org_id"]
    admin_client = get_supabase_client(use_service_role=True)
    data = payload.model_dump(exclude={"portal_email", "portal_password", "portal_contact_name"})
    data["org_id"] = org_id
    if payload.portal_email and payload.portal_password:
        created_user = admin_client.auth.admin.create_user(
            {
                "email": payload.portal_email,
                "password": payload.portal_password,
                "email_confirm": True,
                "user_metadata": {
                    "org_id": org_id,
                    "role": "service",
                    "full_name": payload.portal_contact_name or payload.name,
                    "phone": payload.phone,
                },
            }
        )
        user_id = created_user.user.id if created_user and created_user.user else None
        if not user_id:
            raise HTTPException(status_code=400, detail="Failed to create service center auth user")
        data["profile_id"] = user_id

    response = admin_client.table("service_centers").insert(data).execute()
    if not response.data:
        raise HTTPException(status_code=400, detail="Insert failed")
    return _center_with_portal(response.data[0])


@router.patch("/{center_id}", response_model=ServiceCenterOut)
def update_center(
    center_id: str,
    payload: ServiceCenterUpdate,
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token),
) -> ServiceCenterOut:
    token = _require_token(token)
    admin_client = get_supabase_client(use_service_role=True)
    org_id = profile["org_id"]
    existing = (
        admin_client.table("service_centers")
        .select("*")
        .eq("id", center_id)
        .eq("org_id", org_id)
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Service center not found")

    updates = payload.model_dump(
        exclude_none=True,
        exclude={"portal_email", "portal_password", "portal_contact_name"},
    )
    profile_id = existing.data.get("profile_id")
    auth_updates = {}
    user_metadata = {}
    if payload.portal_email is not None:
        auth_updates["email"] = str(payload.portal_email)
    if payload.portal_password is not None:
        auth_updates["password"] = payload.portal_password
    if payload.portal_contact_name is not None:
        user_metadata["full_name"] = payload.portal_contact_name
    elif payload.name is not None:
        user_metadata["full_name"] = payload.name
    if payload.phone is not None:
        user_metadata["phone"] = payload.phone
    if user_metadata:
        auth_updates["user_metadata"] = user_metadata

    if auth_updates and not profile_id:
        raise HTTPException(status_code=400, detail="No service portal account is linked to this center")
    if auth_updates and profile_id:
        try:
            admin_client.auth.admin.update_user_by_id(profile_id, auth_updates)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Service center auth update failed: {exc}")
    if not updates:
        refreshed = (
            admin_client.table("service_centers")
            .select("*")
            .eq("id", center_id)
            .eq("org_id", org_id)
            .single()
            .execute()
        )
        if not refreshed.data:
            raise HTTPException(status_code=400, detail="Refresh failed")
        return _center_with_portal(refreshed.data)
    response = (
        admin_client.table("service_centers")
        .update(updates)
        .eq("id", center_id)
        .eq("org_id", org_id)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=400, detail="Update failed")
    return _center_with_portal(response.data[0])


@router.delete("/{center_id}")
def delete_center(
    center_id: str,
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token)
) -> dict:
    token = _require_token(token)
    admin_client = get_supabase_client(use_service_role=True)
    org_id = profile["org_id"]
    existing = (
        admin_client.table("service_centers")
        .select("*")
        .eq("id", center_id)
        .eq("org_id", org_id)
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Service center not found")
    if existing.data and existing.data.get("profile_id"):
        admin_client.auth.admin.delete_user(existing.data["profile_id"])
    response = (
        admin_client.table("service_centers")
        .delete()
        .eq("id", center_id)
        .eq("org_id", org_id)
        .execute()
    )
    if response.data is None:
        raise HTTPException(status_code=400, detail="Delete failed")
    return {"status": "ok"}
