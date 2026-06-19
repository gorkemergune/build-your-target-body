import os
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.progress_photo import ProgressPhoto
from app.models.usage_event import UsageEvent
from app.schemas.photo import ProgressPhotoResponse

router = APIRouter(prefix="/photos", tags=["photos"])

UPLOAD_DIR = Path("uploads/progress_photos")
MAX_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
ALLOWED_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
EXT_MAP = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MIME_MAP = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}


def _validate_magic_bytes(content: bytes) -> bool:
    if len(content) < 12:
        return False
    if content[:3] == b"\xff\xd8\xff":
        return True  # JPEG
    if content[:8] == b"\x89PNG\r\n\x1a\n":
        return True  # PNG
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return True  # WebP
    return False


@router.post("", response_model=ProgressPhotoResponse, status_code=status.HTTP_201_CREATED)
async def upload_photo(
    photo: UploadFile = File(...),
    weight_kg: float | None = Form(None),
    body_fat_pct: float | None = Form(None),
    note: str | None = Form(None),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ct = (photo.content_type or "").lower()
    ext = Path(photo.filename or "").suffix.lower()
    if ct not in ALLOWED_TYPES and ext not in ALLOWED_EXTS:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Allowed: jpg, jpeg, png, webp",
        )

    content = await photo.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max 10 MB.")
    if not _validate_magic_bytes(content):
        raise HTTPException(status_code=400, detail="Invalid image file.")

    save_ext = EXT_MAP.get(ct) or (ext if ext in ALLOWED_EXTS else ".jpg")
    filename = f"{uuid4()}{save_ext}"
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    with open(UPLOAD_DIR / filename, "wb") as f:
        f.write(content)

    record = ProgressPhoto(
        user_id=current_user.id,
        image_path=filename,
        weight_kg=weight_kg,
        body_fat_pct=body_fat_pct,
        note=note,
    )
    db.add(record)
    db.add(UsageEvent(user_id=current_user.id, event_type="photo_uploaded"))
    db.commit()
    db.refresh(record)
    return record


@router.get("", response_model=list[ProgressPhotoResponse])
def list_photos(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(ProgressPhoto)
        .filter(ProgressPhoto.user_id == current_user.id)
        .order_by(ProgressPhoto.uploaded_at.desc())
        .all()
    )


@router.get("/{photo_id}/image")
def get_image(
    photo_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = (
        db.query(ProgressPhoto)
        .filter(
            ProgressPhoto.id == photo_id,
            ProgressPhoto.user_id == current_user.id,
        )
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Photo not found")
    file_path = UPLOAD_DIR / record.image_path
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Image file not found")
    ext = Path(record.image_path).suffix.lower()
    with open(file_path, "rb") as f:
        content = f.read()
    return Response(content=content, media_type=MIME_MAP.get(ext, "image/jpeg"))


@router.delete("/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_photo(
    photo_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = (
        db.query(ProgressPhoto)
        .filter(
            ProgressPhoto.id == photo_id,
            ProgressPhoto.user_id == current_user.id,
        )
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Photo not found")
    file_path = UPLOAD_DIR / record.image_path
    if file_path.exists():
        os.remove(file_path)
    db.delete(record)
    db.commit()
