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


@router.get("", response_model=List[ServiceCenterOut])
def list_centers(
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token),
) -> List[ServiceCenterOut]:
    token = _require_token(token)
    supabase = get_supabase_client(token)
    response = supabase.table("service_centers").select("*").execute()
    return response.data or []


@router.post("", response_model=ServiceCenterOut)
def create_center(
    payload: ServiceCenterCreate, 
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token)
) -> ServiceCenterOut:
    token = _require_token(token)
    org_id = profile["org_id"]
    supabase = get_supabase_client(token)
    data = payload.model_dump()
    data["org_id"] = org_id
    response = supabase.table("service_centers").insert(data).execute()
    if not response.data:
        raise HTTPException(status_code=400, detail="Insert failed")
    return response.data[0]


@router.patch("/{center_id}", response_model=ServiceCenterOut)
def update_center(
    center_id: str,
    payload: ServiceCenterUpdate,
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token),
) -> ServiceCenterOut:
    token = _require_token(token)
    supabase = get_supabase_client(token)
    response = (
        supabase.table("service_centers")
        .update(payload.model_dump(exclude_none=True))
        .eq("id", center_id)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=400, detail="Update failed")
    return response.data[0]


@router.delete("/{center_id}")
def delete_center(
    center_id: str,
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token)
) -> dict:
    token = _require_token(token)
    supabase = get_supabase_client(token)
    response = supabase.table("service_centers").delete().eq("id", center_id).execute()
    if response.data is None:
        raise HTTPException(status_code=400, detail="Delete failed")
    return {"status": "ok"}
