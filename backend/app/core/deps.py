from typing import Optional, Dict, Any

from fastapi import Header, HTTPException, Depends

from app.services.supabase_client import get_supabase_client


MANAGER_ROLES = {"owner", "manager"}
DRIVER_ROLES = {"driver"}


def get_bearer_token(authorization: Optional[str] = Header(None)) -> Optional[str]:
    if not authorization:
        return None
    if authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1].strip()
    return None


def get_current_profile(token: Optional[str] = Depends(get_bearer_token)) -> Dict[str, Any]:
    """
    Fetch the current user's profile.
    Profile is expected to be auto-created by the auth.users trigger.
    """
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    # Use service role to bypass RLS and get profile by user ID
    admin_client = get_supabase_client(use_service_role=True)
    user_client = get_supabase_client(token)
    
    # Get user ID from token
    try:
        user = user_client.auth.get_user(token)
        if not user or not user.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        user_id = user.user.id
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Auth error: {str(e)}")
    
    # Fetch profile using admin client (bypasses RLS)
    try:
        response = admin_client.table("profiles").select("*").eq("id", user_id).single().execute()
        if response.data:
            if response.data.get("role") == "driver" and response.data.get("status") != "active":
                raise HTTPException(status_code=403, detail="Inactive driver account")
            return response.data
    except HTTPException:
        raise
    except Exception:
        pass
    
    # Profile not found - user needs to complete setup
    raise HTTPException(
        status_code=404, 
        detail="Profile not found. Please complete account setup."
    )


def require_manager_profile(
    profile: Dict[str, Any] = Depends(get_current_profile),
) -> Dict[str, Any]:
    if profile.get("role") not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Manager access required")
    return profile


def require_manager_or_driver_profile(
    profile: Dict[str, Any] = Depends(get_current_profile),
) -> Dict[str, Any]:
    if profile.get("role") not in MANAGER_ROLES.union(DRIVER_ROLES):
        raise HTTPException(status_code=403, detail="Access denied")
    return profile
