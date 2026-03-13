from typing import List

from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import require_manager_profile, require_manager_or_driver_profile
from app.schemas.driver_scores import DriverScoreCreate, DriverScoreOut
from app.services.supabase_client import get_supabase_client

router = APIRouter(prefix="/driver-scores", tags=["driver-scores"])


@router.get("", response_model=List[DriverScoreOut])
def list_driver_scores(
    profile: dict = Depends(require_manager_profile),
) -> List[DriverScoreOut]:
    supabase = get_supabase_client(use_service_role=True)
    response = (
        supabase.table("driver_scores")
        .select("*")
        .eq("org_id", profile["org_id"])
        .order("computed_at", desc=True)
        .limit(500)
        .execute()
    )
    return response.data or []


@router.post("/me", response_model=DriverScoreOut)
def create_my_driver_score(
    payload: DriverScoreCreate,
    profile: dict = Depends(require_manager_or_driver_profile),
) -> DriverScoreOut:
    if profile.get("role") != "driver":
        raise HTTPException(status_code=403, detail="Driver access required")

    overall = max(0, min(100, int(payload.overall_score)))
    data = payload.model_dump()
    data["overall_score"] = overall
    data["org_id"] = profile["org_id"]
    data["driver_id"] = profile["id"]
    data["driver_name"] = profile.get("full_name")

    supabase = get_supabase_client(use_service_role=True)
    response = supabase.table("driver_scores").insert(data).execute()
    if not response.data:
        raise HTTPException(status_code=400, detail="Insert failed")
    return response.data[0]
