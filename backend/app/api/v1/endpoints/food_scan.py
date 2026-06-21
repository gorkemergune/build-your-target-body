import asyncio
import base64
import json
import logging
import re
import time
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user, get_db
from app.models.ai_scan_log import AiScanLog
from app.models.nutrition_log import FoodEntry, NutritionLog
from app.models.user import User
from app.services.gemini_client import GEMINI_MODEL

_log = logging.getLogger("app.gemini")
router = APIRouter(prefix="/nutrition", tags=["food-scan"])

UPLOAD_DIR = Path("uploads/food_photos")
MAX_SIZE = 10 * 1024 * 1024  # 10 MB

_ALLOWED_MAGIC = {
    b"\xff\xd8\xff": "image/jpeg",
    b"\x89PNG": "image/png",
}


def _validate_image(content: bytes) -> str:
    for magic, mime in _ALLOWED_MAGIC.items():
        if content[: len(magic)] == magic:
            return mime
    if len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    raise HTTPException(status_code=400, detail="Invalid image file. Only JPEG, PNG, and WebP are supported.")


_SYSTEM_PROMPT = """\
You are a nutrition analysis AI. Analyze the food in this image and return ONLY a valid JSON object.

Rules:
1. Return ONLY raw JSON. No markdown, no code blocks, no explanation.
2. Estimate calories and macros per food item based on typical serving sizes visible.
3. If you cannot identify a food, skip it.
4. Round all numbers to the nearest integer.
5. The confidence field is a float from 0.0 to 1.0.

Required format:
{
  "foods": [
    {
      "name": "food name in English",
      "estimated_serving": "e.g. 150g or 1 cup",
      "calories": 320,
      "protein": 28,
      "carbs": 5,
      "fat": 8
    }
  ],
  "confidence": 0.85,
  "notes": "optional one sentence about the analysis quality"
}
"""


async def _call_gemini_vision(image_bytes: bytes, mime_type: str) -> dict:
    if not settings.GEMINI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Food photo analysis requires Gemini API. Please configure GEMINI_API_KEY.",
        )

    import google.generativeai as genai

    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel(GEMINI_MODEL)

    image_part = {
        "mime_type": mime_type,
        "data": base64.b64encode(image_bytes).decode(),
    }

    def _generate():
        return model.generate_content([_SYSTEM_PROMPT, image_part])

    t0 = time.perf_counter()
    try:
        loop = asyncio.get_event_loop()
        response = await asyncio.wait_for(
            loop.run_in_executor(None, _generate),
            timeout=25.0,
        )
        latency_ms = round((time.perf_counter() - t0) * 1000)
        _log.info(
            '{"event":"gemini_ok","prompt_type":"food_vision","model":"%s","latency_ms":%d}',
            GEMINI_MODEL,
            latency_ms,
        )
    except asyncio.TimeoutError:
        latency_ms = round((time.perf_counter() - t0) * 1000)
        _log.warning(
            '{"event":"gemini_timeout","prompt_type":"food_vision","latency_ms":%d}',
            latency_ms,
        )
        raise HTTPException(status_code=504, detail="Food analysis timed out. Please try again.")

    raw = response.text.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
    raw = re.sub(r"\s*```$", "", raw, flags=re.MULTILINE)

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=502,
            detail="Food analysis returned an unexpected format. Please try again.",
        )

    return result


# ── Analyze Photo ─────────────────────────────────────────────────────────────

@router.post("/analyze-photo", status_code=status.HTTP_200_OK)
async def analyze_food_photo(
    photo: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    content = await photo.read()

    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="Image too large. Maximum size is 10 MB.")

    mime_type = _validate_image(content)

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    ext = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}.get(mime_type, ".jpg")
    filename = f"{uuid.uuid4().hex}{ext}"
    (UPLOAD_DIR / filename).write_bytes(content)

    result = await _call_gemini_vision(content, mime_type)

    foods = result.get("foods", [])
    if not isinstance(foods, list):
        foods = []

    sanitized_foods = []
    for item in foods:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name", "")).strip()[:200]
        if not name:
            continue
        sanitized_foods.append({
            "name": name,
            "estimated_serving": str(item.get("estimated_serving", "")).strip()[:100],
            "calories": max(0, int(item.get("calories") or 0)),
            "protein": max(0, int(item.get("protein") or 0)),
            "carbs": max(0, int(item.get("carbs") or 0)),
            "fat": max(0, int(item.get("fat") or 0)),
        })

    confidence = float(result.get("confidence") or 0.0)
    confidence = max(0.0, min(1.0, confidence))

    total_calories = sum(f["calories"] for f in sanitized_foods)
    total_protein = sum(f["protein"] for f in sanitized_foods)
    total_carbs = sum(f["carbs"] for f in sanitized_foods)
    total_fat = sum(f["fat"] for f in sanitized_foods)

    # Store the AI scan log for audit / analytics
    ai_payload = {
        "foods": sanitized_foods,
        "totals": {"calories": total_calories, "protein": total_protein, "carbs": total_carbs, "fat": total_fat},
        "confidence": confidence,
        "notes": str(result.get("notes", "")).strip()[:300],
    }
    scan_log = AiScanLog(
        user_id=current_user.id,
        photo_token=filename,
        ai_estimate=json.dumps(ai_payload, ensure_ascii=False),
        food_count_ai=len(sanitized_foods),
        ai_calories=float(total_calories) if total_calories else None,
        ai_protein_g=float(total_protein) if total_protein else None,
        ai_carbs_g=float(total_carbs) if total_carbs else None,
        ai_fat_g=float(total_fat) if total_fat else None,
        created_at=datetime.now(timezone.utc),
    )
    db.add(scan_log)
    db.commit()
    db.refresh(scan_log)

    return {
        "scan_log_id": scan_log.id,
        "photo_token": filename,
        "foods": sanitized_foods,
        "totals": {
            "calories": total_calories,
            "protein": total_protein,
            "carbs": total_carbs,
            "fat": total_fat,
        },
        "confidence": confidence,
        "notes": str(result.get("notes", "")).strip()[:300],
    }


# ── Save Scan ────────────────────────────────────────────────────────────────

class ScanFoodItem(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=255)]
    calories: Annotated[float | None, Field(None, ge=0, le=10000)] = None
    protein_g: Annotated[float | None, Field(None, ge=0, le=1000)] = None
    carbs_g: Annotated[float | None, Field(None, ge=0, le=2000)] = None
    fat_g: Annotated[float | None, Field(None, ge=0, le=1000)] = None
    estimated_serving: str | None = None


class ScanSaveRequest(BaseModel):
    scan_log_id: int
    logged_date: date
    meal_type: Annotated[str, Field(pattern="^(breakfast|lunch|dinner|snack)$")]
    foods: list[ScanFoodItem]


@router.post("/scan-save", status_code=status.HTTP_201_CREATED)
def save_scan(
    payload: ScanSaveRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not payload.foods:
        raise HTTPException(status_code=422, detail="No foods provided")

    scan_log = db.query(AiScanLog).filter(
        AiScanLog.id == payload.scan_log_id,
        AiScanLog.user_id == current_user.id,
    ).first()
    if not scan_log:
        raise HTTPException(status_code=404, detail="Scan log not found")

    # Upsert nutrition log
    log = db.query(NutritionLog).filter(
        NutritionLog.user_id == current_user.id,
        NutritionLog.logged_date == payload.logged_date,
    ).first()
    if not log:
        log = NutritionLog(user_id=current_user.id, logged_date=payload.logged_date)
        db.add(log)
        db.flush()

    # Store photo reference on the log if not already set
    if not log.photo_path and scan_log.photo_token:
        log.photo_path = scan_log.photo_token

    # Aggregate final totals
    final_cal = sum(f.calories or 0 for f in payload.foods)
    final_protein = sum(f.protein_g or 0 for f in payload.foods)
    final_carbs = sum(f.carbs_g or 0 for f in payload.foods)
    final_fat = sum(f.fat_g or 0 for f in payload.foods)

    # Create food entries
    for food in payload.foods:
        entry = FoodEntry(
            nutrition_log_id=log.id,
            meal_type=payload.meal_type,
            food_name=food.name.strip(),
            calories=food.calories,
            protein_g=food.protein_g,
            carbs_g=food.carbs_g,
            fat_g=food.fat_g,
        )
        db.add(entry)

    # Update scan log with final (user-adjusted) values
    scan_log.final_calories = float(final_cal) if final_cal else None
    scan_log.final_protein_g = float(final_protein) if final_protein else None
    scan_log.final_carbs_g = float(final_carbs) if final_carbs else None
    scan_log.final_fat_g = float(final_fat) if final_fat else None
    scan_log.food_count_final = len(payload.foods)
    scan_log.nutrition_log_id = log.id
    scan_log.saved_at = datetime.now(timezone.utc)

    db.commit()
    return {"nutrition_log_id": log.id, "scan_log_id": scan_log.id}
