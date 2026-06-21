import re
from datetime import datetime, timedelta, timezone
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.barcode import BarcodeCache, BarcodeScan
from app.models.user import User

router = APIRouter(prefix="/barcode", tags=["barcode"])

_OFF_URL = "https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
_CACHE_TTL_DAYS = 30
_BARCODE_RE = re.compile(r"^\d{8,14}$")


# ── Schemas ───────────────────────────────────────────────────────────────────

class BarcodeLookupRequest(BaseModel):
    barcode: str = Field(..., min_length=8, max_length=14)
    source: Literal["camera", "manual"] = "manual"


class BarcodeResultResponse(BaseModel):
    found: bool
    barcode: str
    food_name: str | None = None
    brand: str | None = None
    calories_per_100g: float | None = None
    protein_g_per_100g: float | None = None
    carbs_g_per_100g: float | None = None
    fat_g_per_100g: float | None = None
    serving_size_g: float | None = None
    serving_size_desc: str | None = None
    source: str | None = None
    has_nutrition: bool = False


# ── Helpers ───────────────────────────────────────────────────────────────────

def _safe_float(val) -> float | None:
    try:
        f = float(val)
        return round(f, 2) if f >= 0 else None
    except (TypeError, ValueError):
        return None


def _parse_serving_g(serving_str: str | None) -> float | None:
    if not serving_str:
        return None
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*g", str(serving_str), re.IGNORECASE)
    if m:
        try:
            return float(m.group(1).replace(",", "."))
        except ValueError:
            return None
    return None


def _record_scan(db: Session, user_id: int, barcode: str, success: bool, source: str) -> None:
    scan = BarcodeScan(
        user_id=user_id,
        barcode=barcode,
        success=success,
        scan_source=source,
        created_at=datetime.now(timezone.utc),
    )
    db.add(scan)


def _cache_to_response(cached: BarcodeCache) -> BarcodeResultResponse:
    has_nutrition = any(
        v is not None
        for v in [cached.calories_per_100g, cached.protein_g_per_100g]
    )
    return BarcodeResultResponse(
        found=True,
        barcode=cached.barcode,
        food_name=cached.food_name,
        brand=cached.brand,
        calories_per_100g=cached.calories_per_100g,
        protein_g_per_100g=cached.protein_g_per_100g,
        carbs_g_per_100g=cached.carbs_g_per_100g,
        fat_g_per_100g=cached.fat_g_per_100g,
        serving_size_g=cached.serving_size_g,
        serving_size_desc=cached.serving_size_desc,
        source=cached.source,
        has_nutrition=has_nutrition,
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/lookup", response_model=BarcodeResultResponse)
async def lookup_barcode(
    payload: BarcodeLookupRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    barcode = payload.barcode.strip()
    if not _BARCODE_RE.match(barcode):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Barcode must be 8-14 digits")

    # ── Check cache ──────────────────────────────────────────────────────────
    cached = db.query(BarcodeCache).filter(BarcodeCache.barcode == barcode).first()
    if cached:
        age = datetime.now(timezone.utc) - cached.fetched_at.replace(tzinfo=timezone.utc)
        if age < timedelta(days=_CACHE_TTL_DAYS):
            _record_scan(db, current_user.id, barcode, True, payload.source)
            db.commit()
            return _cache_to_response(cached)

    # ── Fetch from Open Food Facts ───────────────────────────────────────────
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            resp = await client.get(
                _OFF_URL.format(barcode=barcode),
                headers={"User-Agent": "BuildYourTargetBody/1.0 (contact@buildyourtargetbody.com)"},
            )
    except httpx.TimeoutException:
        # Return cached stale data if available rather than erroring
        if cached:
            _record_scan(db, current_user.id, barcode, True, payload.source)
            db.commit()
            return _cache_to_response(cached)
        _record_scan(db, current_user.id, barcode, False, payload.source)
        db.commit()
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="Food database request timed out")
    except httpx.RequestError:
        if cached:
            _record_scan(db, current_user.id, barcode, True, payload.source)
            db.commit()
            return _cache_to_response(cached)
        _record_scan(db, current_user.id, barcode, False, payload.source)
        db.commit()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Could not reach food database")

    if resp.status_code != 200:
        _record_scan(db, current_user.id, barcode, False, payload.source)
        db.commit()
        return BarcodeResultResponse(found=False, barcode=barcode)

    try:
        data = resp.json()
    except Exception:
        _record_scan(db, current_user.id, barcode, False, payload.source)
        db.commit()
        return BarcodeResultResponse(found=False, barcode=barcode)

    if data.get("status") != 1:
        _record_scan(db, current_user.id, barcode, False, payload.source)
        db.commit()
        return BarcodeResultResponse(found=False, barcode=barcode)

    # ── Parse product data ───────────────────────────────────────────────────
    product = data.get("product") or {}
    nutriments = product.get("nutriments") or {}

    food_name = (
        product.get("product_name")
        or product.get("product_name_en")
        or product.get("abbreviated_product_name")
        or "Unknown Product"
    ).strip()[:300]

    brand_raw = product.get("brands") or ""
    brand = brand_raw.split(",")[0].strip()[:200] if brand_raw else None

    # Prefer per-100g values; fallback to non-suffixed keys
    cal = _safe_float(nutriments.get("energy-kcal_100g") or nutriments.get("energy-kcal"))
    protein = _safe_float(nutriments.get("proteins_100g") or nutriments.get("proteins"))
    carbs = _safe_float(nutriments.get("carbohydrates_100g") or nutriments.get("carbohydrates"))
    fat = _safe_float(nutriments.get("fat_100g") or nutriments.get("fat"))

    serving_size_desc = product.get("serving_size") or None
    serving_size_g = _parse_serving_g(serving_size_desc)

    # ── Upsert cache ─────────────────────────────────────────────────────────
    cache_entry = BarcodeCache(
        barcode=barcode,
        food_name=food_name,
        brand=brand,
        calories_per_100g=cal,
        protein_g_per_100g=protein,
        carbs_g_per_100g=carbs,
        fat_g_per_100g=fat,
        serving_size_g=serving_size_g,
        serving_size_desc=str(serving_size_desc)[:100] if serving_size_desc else None,
        source="openfoodfacts",
        fetched_at=datetime.now(timezone.utc),
    )
    db.merge(cache_entry)
    _record_scan(db, current_user.id, barcode, True, payload.source)
    db.commit()

    has_nutrition = cal is not None or protein is not None
    return BarcodeResultResponse(
        found=True,
        barcode=barcode,
        food_name=food_name,
        brand=brand,
        calories_per_100g=cal,
        protein_g_per_100g=protein,
        carbs_g_per_100g=carbs,
        fat_g_per_100g=fat,
        serving_size_g=serving_size_g,
        serving_size_desc=str(serving_size_desc) if serving_size_desc else None,
        source="openfoodfacts",
        has_nutrition=has_nutrition,
    )


@router.get("/stats")
def get_scan_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from sqlalchemy import func
    total = db.query(func.count(BarcodeScan.id)).filter(BarcodeScan.user_id == current_user.id).scalar() or 0
    success = db.query(func.count(BarcodeScan.id)).filter(
        BarcodeScan.user_id == current_user.id,
        BarcodeScan.success.is_(True),
    ).scalar() or 0
    camera = db.query(func.count(BarcodeScan.id)).filter(
        BarcodeScan.user_id == current_user.id,
        BarcodeScan.scan_source == "camera",
    ).scalar() or 0
    return {
        "total_scans": total,
        "successful_scans": success,
        "failed_scans": total - success,
        "camera_scans": camera,
        "manual_scans": total - camera,
        "success_rate_pct": round(success / total * 100) if total > 0 else 0,
    }
