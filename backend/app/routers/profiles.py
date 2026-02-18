from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import get_bearer_token, get_current_profile
from app.schemas.profiles import ProfileOut, ProfileUpdate, PasswordUpdate
from app.services.supabase_client import get_supabase_client

router = APIRouter(prefix="/profiles", tags=["profiles"])


@router.get("/me", response_model=ProfileOut)
def get_my_profile(profile: dict = Depends(get_current_profile)) -> ProfileOut:
    return profile


@router.patch("/me", response_model=ProfileOut)
def update_my_profile(
    payload: ProfileUpdate, profile: dict = Depends(get_current_profile)
) -> ProfileOut:
    data = payload.model_dump(exclude_unset=True)
    if not data:
        return profile
    admin_client = get_supabase_client(use_service_role=True)
    try:
        response = (
            admin_client.table("profiles")
            .update(data)
            .eq("id", profile["id"])
            .execute()
        )
        if response.data:
            if isinstance(response.data, list):
                return response.data[0]
            return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Update failed: {str(e)}")
    raise HTTPException(status_code=500, detail="Update failed")


@router.post("/me/password")
def update_password(
    payload: PasswordUpdate, token: str = Depends(get_bearer_token)
) -> dict:
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    user_client = get_supabase_client(token)
    try:
        user = user_client.auth.get_user(token)
        if not user or not user.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        email = user.user.email
        if not email:
            raise HTTPException(status_code=400, detail="Email not found")
        auth_res = user_client.auth.sign_in_with_password(
            {"email": email, "password": payload.current_password}
        )
        if auth_res.user is None:
            raise HTTPException(status_code=401, detail="Current password is incorrect")
        user_client.auth.update_user({"password": payload.new_password})
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Password update failed: {str(e)}")
