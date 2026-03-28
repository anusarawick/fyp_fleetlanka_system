from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import get_bearer_token, require_manager_profile
from app.schemas.saved_places import SavedPlaceCreate, SavedPlaceOut
from app.services.supabase_client import get_supabase_client

router = APIRouter(prefix="/saved-places", tags=["saved-places"])


def _require_token(token: Optional[str]) -> str:
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    return token


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
    response = supabase.table("saved_places").insert(data).execute()
    if not response.data:
        raise HTTPException(status_code=400, detail="Insert failed")
    return response.data[0]
