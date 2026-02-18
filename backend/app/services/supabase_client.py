from __future__ import annotations

from typing import Optional

from supabase import Client, create_client

from app.core.config import settings


def get_supabase_client(
    token: Optional[str] = None, *, use_service_role: bool = False
) -> Client:
    if not settings.supabase_url:
        raise RuntimeError("SUPABASE_URL is not set")

    # Use anon key with user token for RLS, fallback to service role if no token.
    key = settings.supabase_anon_key
    if use_service_role and settings.supabase_service_role_key:
        key = settings.supabase_service_role_key
    elif not token and settings.supabase_service_role_key:
        key = settings.supabase_service_role_key

    if not key:
        raise RuntimeError("SUPABASE key is not set")

    client = create_client(settings.supabase_url, key)
    if token:
        client.postgrest.auth(token)
    return client
