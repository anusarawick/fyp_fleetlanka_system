from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import get_bearer_token, require_manager_profile
from app.schemas.saved_places import SavedPlaceCreate, SavedPlaceOut, SavedPlaceUpdate
from app.services.supabase_client import get_supabase_client

router = APIRouter(prefix="/saved-places", tags=["saved-places"])


def _require_token(token: Optional[str]) -> str:
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    return token


def _ensure_unique_name(supabase, org_id: str, name: str, exclude_id: Optional[str] = None) -> None:
    response = (
        supabase.table("saved_places")
        .select("id,name")
        .eq("org_id", org_id)
        .execute()
    )
    candidate = name.strip().lower()
    for row in response.data or []:
        if exclude_id and row.get("id") == exclude_id:
            continue
        existing = str(row.get("name") or "").strip().lower()
        if existing == candidate:
            raise HTTPException(status_code=400, detail="A saved place with this name already exists")


@router.get("", response_model=List[SavedPlaceOut])
def list_saved_places(
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token),
) -> List[SavedPlaceOut]:
    token = _require_token(token)
    supabase = get_supabase_client(use_service_role=True)
    response = (
        supabase.table("saved_places")
        .select("*")
        .eq("org_id", profile["org_id"])
        .order("name")
        .execute()
    )
    return response.data or []


@router.post("", response_model=SavedPlaceOut)
def create_saved_place(
    payload: SavedPlaceCreate,
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token),
) -> SavedPlaceOut:
    token = _require_token(token)
    supabase = get_supabase_client(use_service_role=True)
    data = payload.model_dump()
    data["org_id"] = profile["org_id"]
    _ensure_unique_name(supabase, profile["org_id"], data["name"])
    response = supabase.table("saved_places").insert(data).execute()
    if not response.data:
        raise HTTPException(status_code=400, detail="Insert failed")
    return response.data[0]


@router.patch("/{place_id}", response_model=SavedPlaceOut)
def update_saved_place(
    place_id: str,
    payload: SavedPlaceUpdate,
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token),
) -> SavedPlaceOut:
    token = _require_token(token)
    supabase = get_supabase_client(use_service_role=True)
    _ensure_unique_name(supabase, profile["org_id"], payload.name, exclude_id=place_id)
    response = (
        supabase.table("saved_places")
        .update(payload.model_dump())
        .eq("id", place_id)
        .eq("org_id", profile["org_id"])
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Saved place not found")
    return response.data[0]


@router.delete("/{place_id}")
def delete_saved_place(
    place_id: str,
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token),
) -> dict:
    token = _require_token(token)
    supabase = get_supabase_client(use_service_role=True)
    response = (
        supabase.table("saved_places")
        .delete()
        .eq("id", place_id)
        .eq("org_id", profile["org_id"])
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Saved place not found")
    return {"success": True}
