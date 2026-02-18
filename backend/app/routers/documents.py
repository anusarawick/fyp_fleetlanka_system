from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import get_bearer_token, get_current_profile
from app.schemas.documents import DocumentCreate, DocumentOut, DocumentUpdate
from app.services.supabase_client import get_supabase_client

router = APIRouter(prefix="/documents", tags=["documents"])


def _require_token(token: Optional[str]) -> str:
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    return token


@router.get("", response_model=List[DocumentOut])
def list_documents(token: Optional[str] = Depends(get_bearer_token)) -> List[DocumentOut]:
    token = _require_token(token)
    supabase = get_supabase_client(token)
    response = supabase.table("documents").select("*").execute()
    return response.data or []


@router.post("", response_model=DocumentOut)
def create_document(
    payload: DocumentCreate, 
    profile: dict = Depends(get_current_profile),
    token: Optional[str] = Depends(get_bearer_token)
) -> DocumentOut:
    token = _require_token(token)
    org_id = profile["org_id"]
    supabase = get_supabase_client(token)
    data = payload.model_dump()
    data["org_id"] = org_id
    response = supabase.table("documents").insert(data).execute()
    if not response.data:
        raise HTTPException(status_code=400, detail="Insert failed")
    return response.data[0]


@router.patch("/{doc_id}", response_model=DocumentOut)
def update_document(
    doc_id: str,
    payload: DocumentUpdate,
    token: Optional[str] = Depends(get_bearer_token),
) -> DocumentOut:
    token = _require_token(token)
    supabase = get_supabase_client(token)
    response = (
        supabase.table("documents")
        .update(payload.model_dump(exclude_none=True))
        .eq("id", doc_id)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=400, detail="Update failed")
    return response.data[0]


@router.delete("/{doc_id}")
def delete_document(doc_id: str, token: Optional[str] = Depends(get_bearer_token)) -> dict:
    token = _require_token(token)
    supabase = get_supabase_client(token)
    response = supabase.table("documents").delete().eq("id", doc_id).execute()
    if response.data is None:
        raise HTTPException(status_code=400, detail="Delete failed")
    return {"status": "ok"}
