from pathlib import Path
from typing import List, Optional
from urllib.parse import parse_qs, quote, unquote, urlencode, urlparse
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.core.deps import get_bearer_token, require_manager_profile
from app.schemas.documents import DocumentCreate, DocumentFileUrlOut, DocumentOut, DocumentUpdate
from app.services.supabase_client import get_supabase_client

router = APIRouter(prefix="/documents", tags=["documents"])

DOCUMENT_FILE_BUCKET = "document-files"
DOCUMENT_FILE_MAX_BYTES = 10 * 1024 * 1024
DOCUMENT_FILE_SIGNED_URL_TTL_SECONDS = 10 * 60
DOCUMENT_FILE_EXTENSIONS = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}
DOCUMENT_FILE_MIME_BY_EXTENSION = {extension: mime_type for mime_type, extension in DOCUMENT_FILE_EXTENSIONS.items()}
DOCUMENT_FILE_REFERENCE_SCHEME = "document-files"


def _require_token(token: Optional[str]) -> str:
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    return token


def _get_manager_document(admin_client, doc_id: str, org_id: str) -> dict:
    doc_resp = (
        admin_client.table("documents")
        .select("*")
        .eq("id", doc_id)
        .eq("org_id", org_id)
        .single()
        .execute()
    )
    if not doc_resp.data:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc_resp.data


def _remove_document_file(storage, file_path: Optional[str]) -> None:
    if not file_path:
        return
    try:
        storage.from_(DOCUMENT_FILE_BUCKET).remove([file_path])
    except Exception:
        pass


def _signed_url_from_response(response) -> str:
    if isinstance(response, dict):
        return response.get("signedURL") or response.get("signedUrl") or response.get("signed_url") or ""
    signed_url = getattr(response, "signed_url", None) or getattr(response, "signedURL", None)
    if signed_url:
        return str(signed_url)
    return str(response)


def _document_file_path(document: dict) -> Optional[str]:
    file_path = document.get("file_path")
    if file_path:
        return file_path
    file_url = document.get("file_url")
    if isinstance(file_url, str) and file_url.startswith(f"{DOCUMENT_FILE_REFERENCE_SCHEME}://"):
        parsed = urlparse(file_url)
        return unquote(f"{parsed.netloc}{parsed.path}")
    if isinstance(file_url, str) and file_url and not file_url.startswith(("http://", "https://")):
        return file_url
    return None


def _document_file_reference(file_path: str, file_name: str, mime_type: str, size_bytes: int) -> str:
    query = urlencode({"name": file_name, "type": mime_type, "size": str(size_bytes)})
    return f"{DOCUMENT_FILE_REFERENCE_SCHEME}://{quote(file_path, safe='')}?{query}"


def _document_reference_metadata(document: dict) -> dict:
    file_url = document.get("file_url")
    if not isinstance(file_url, str) or not file_url.startswith(f"{DOCUMENT_FILE_REFERENCE_SCHEME}://"):
        return {}
    parsed = urlparse(file_url)
    query = parse_qs(parsed.query)
    metadata: dict = {}
    if query.get("name"):
        metadata["file_name"] = query["name"][0]
    if query.get("type"):
        metadata["file_mime_type"] = query["type"][0]
    if query.get("size"):
        try:
            metadata["file_size_bytes"] = int(query["size"][0])
        except ValueError:
            pass
    return metadata


def _document_with_upload_metadata(document: dict, file_path: str, file_name: str, mime_type: str, size_bytes: int) -> dict:
    enriched = dict(document)
    enriched["file_path"] = enriched.get("file_path") or file_path
    enriched["file_url"] = enriched.get("file_url") or file_path
    enriched["file_name"] = enriched.get("file_name") or file_name
    enriched["file_mime_type"] = enriched.get("file_mime_type") or mime_type
    enriched["file_size_bytes"] = enriched.get("file_size_bytes") or size_bytes
    return enriched


def _guess_file_mime_type(file_path: Optional[str]) -> Optional[str]:
    if not file_path:
        return None
    extension = file_path.rsplit(".", 1)[-1].lower() if "." in file_path else ""
    return DOCUMENT_FILE_MIME_BY_EXTENSION.get(extension)


def _enrich_document_from_storage(storage, document: dict) -> dict:
    file_path = _document_file_path(document)
    if not file_path:
        return document
    enriched = dict(document)
    reference_metadata = _document_reference_metadata(document)
    enriched["file_path"] = enriched.get("file_path") or file_path
    enriched["file_name"] = enriched.get("file_name") or reference_metadata.get("file_name") or Path(file_path).name
    enriched["file_mime_type"] = enriched.get("file_mime_type") or reference_metadata.get("file_mime_type") or _guess_file_mime_type(file_path)
    enriched["file_size_bytes"] = enriched.get("file_size_bytes") or reference_metadata.get("file_size_bytes")
    if enriched.get("file_size_bytes"):
        return enriched
    try:
        parent_path, file_name = file_path.rsplit("/", 1)
        rows = storage.from_(DOCUMENT_FILE_BUCKET).list(parent_path)
        for row in rows:
            if row.get("name") != file_name:
                continue
            metadata = row.get("metadata") or {}
            size = metadata.get("size") or metadata.get("contentLength")
            if size:
                enriched["file_size_bytes"] = int(size)
            enriched["file_mime_type"] = enriched.get("file_mime_type") or metadata.get("mimetype")
            break
    except Exception:
        pass
    return enriched


@router.get("", response_model=List[DocumentOut])
def list_documents(
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token),
) -> List[DocumentOut]:
    token = _require_token(token)
    supabase = get_supabase_client(token)
    response = supabase.table("documents").select("*").execute()
    documents = response.data or []
    try:
        storage = get_supabase_client(use_service_role=True).storage
        return [_enrich_document_from_storage(storage, document) for document in documents]
    except Exception:
        return documents


@router.post("", response_model=DocumentOut)
def create_document(
    payload: DocumentCreate, 
    profile: dict = Depends(require_manager_profile),
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


@router.post("/{doc_id}/file", response_model=DocumentOut)
async def upload_document_file(
    doc_id: str,
    file: UploadFile = File(...),
    profile: dict = Depends(require_manager_profile),
) -> DocumentOut:
    content_type = file.content_type or ""
    if content_type not in DOCUMENT_FILE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Document file must be PDF, JPG, PNG, or WebP")
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Document file is empty")
    if len(contents) > DOCUMENT_FILE_MAX_BYTES:
        raise HTTPException(status_code=400, detail="Document file must be 10MB or smaller")

    admin_client = get_supabase_client(use_service_role=True)
    document = _get_manager_document(admin_client, doc_id, profile["org_id"])
    storage = admin_client.storage
    _remove_document_file(storage, document.get("file_path"))

    original_name = Path(file.filename or "document").name
    extension = DOCUMENT_FILE_EXTENSIONS[content_type]
    file_path = f"{profile['org_id']}/{doc_id}/{uuid4().hex}.{extension}"
    try:
        storage.from_(DOCUMENT_FILE_BUCKET).upload(
            file_path,
            contents,
            {"content-type": content_type, "upsert": "true"},
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Document file upload failed: {exc}") from exc

    file_reference = _document_file_reference(file_path, original_name, content_type, len(contents))
    try:
        updated_resp = (
            admin_client.table("documents")
            .update(
                {
                    "file_path": file_path,
                    "file_name": original_name,
                    "file_mime_type": content_type,
                    "file_size_bytes": len(contents),
                    "file_url": file_reference,
                }
            )
            .eq("id", doc_id)
            .eq("org_id", profile["org_id"])
            .execute()
        )
    except Exception:
        updated_resp = (
            admin_client.table("documents")
            .update({"file_url": file_reference})
            .eq("id", doc_id)
            .eq("org_id", profile["org_id"])
            .execute()
        )
    if not updated_resp.data:
        raise HTTPException(status_code=400, detail="Failed to save document file")
    return _document_with_upload_metadata(updated_resp.data[0], file_path, original_name, content_type, len(contents))


@router.delete("/{doc_id}/file", response_model=DocumentOut)
def delete_document_file(
    doc_id: str,
    profile: dict = Depends(require_manager_profile),
) -> DocumentOut:
    admin_client = get_supabase_client(use_service_role=True)
    document = _get_manager_document(admin_client, doc_id, profile["org_id"])
    _remove_document_file(admin_client.storage, _document_file_path(document))
    try:
        updated_resp = (
            admin_client.table("documents")
            .update(
                {
                    "file_path": None,
                    "file_name": None,
                    "file_mime_type": None,
                    "file_size_bytes": None,
                    "file_url": None,
                }
            )
            .eq("id", doc_id)
            .eq("org_id", profile["org_id"])
            .execute()
        )
    except Exception:
        updated_resp = (
            admin_client.table("documents")
            .update({"file_url": None})
            .eq("id", doc_id)
            .eq("org_id", profile["org_id"])
            .execute()
        )
    if not updated_resp.data:
        raise HTTPException(status_code=400, detail="Failed to remove document file")
    return updated_resp.data[0]


@router.get("/{doc_id}/file-url", response_model=DocumentFileUrlOut)
def get_document_file_url(
    doc_id: str,
    profile: dict = Depends(require_manager_profile),
) -> DocumentFileUrlOut:
    admin_client = get_supabase_client(use_service_role=True)
    document = _get_manager_document(admin_client, doc_id, profile["org_id"])
    file_path = _document_file_path(document)
    if not file_path:
        raise HTTPException(status_code=404, detail="Document file not found")
    try:
        signed_url_resp = admin_client.storage.from_(DOCUMENT_FILE_BUCKET).create_signed_url(
            file_path,
            DOCUMENT_FILE_SIGNED_URL_TTL_SECONDS,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to create document file URL: {exc}") from exc
    url = _signed_url_from_response(signed_url_resp)
    if not url:
        raise HTTPException(status_code=500, detail="Failed to create document file URL")
    return DocumentFileUrlOut(url=url)


@router.patch("/{doc_id}", response_model=DocumentOut)
def update_document(
    doc_id: str,
    payload: DocumentUpdate,
    profile: dict = Depends(require_manager_profile),
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
def delete_document(
    doc_id: str,
    profile: dict = Depends(require_manager_profile),
    token: Optional[str] = Depends(get_bearer_token),
) -> dict:
    token = _require_token(token)
    admin_client = get_supabase_client(use_service_role=True)
    document = _get_manager_document(admin_client, doc_id, profile["org_id"])
    _remove_document_file(admin_client.storage, _document_file_path(document))
    supabase = get_supabase_client(token)
    response = supabase.table("documents").delete().eq("id", doc_id).execute()
    if response.data is None:
        raise HTTPException(status_code=400, detail="Delete failed")
    return {"status": "ok"}
