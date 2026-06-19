import json
from datetime import datetime, date, timezone
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.body_fat_log import BodyFatLog
from app.models.goal import Goal
from app.models.measurement_log import MeasurementLog
from app.models.nutrition_log import FoodEntry, NutritionLog
from app.models.user import User
from app.models.weight_log import WeightLog
from app.models.workout import Workout, WorkoutExercise

router = APIRouter(prefix="/import", tags=["import"])

_VALID_GOAL_TYPES = {"weight_loss", "weight_gain", "recomp", "muscle_gain"}
_VALID_MEAL_TYPES = {"breakfast", "lunch", "dinner", "snack"}


def _f(v: Any, lo: float | None = None, hi: float | None = None) -> float | None:
    """Parse and range-check a float."""
    if v is None:
        return None
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    if lo is not None and x < lo:
        return None
    if hi is not None and x > hi:
        return None
    return round(x, 4)


def _i(v: Any, lo: int | None = None, hi: int | None = None) -> int | None:
    """Parse and range-check an int."""
    if v is None:
        return None
    try:
        x = int(v)
    except (TypeError, ValueError):
        return None
    if lo is not None and x < lo:
        return None
    if hi is not None and x > hi:
        return None
    return x


def _str(v: Any, max_len: int = 500) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    return s[:max_len] if s else None


def _parse_date(v: Any) -> date | None:
    if v is None:
        return None
    try:
        return date.fromisoformat(str(v)[:10])
    except ValueError:
        return None


def _parse_datetime(v: Any) -> datetime | None:
    if v is None:
        return None
    try:
        s = str(v)[:26]
        if "T" not in s:
            s += "T00:00:00"
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None


@router.post("/json", status_code=status.HTTP_200_OK)
async def import_json(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB).")

    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file.")

    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="Invalid export format.")

    if data.get("export_version") != "1":
        raise HTTPException(status_code=400, detail="Unsupported export version. Expected version 1.")

    counts: dict[str, int] = {
        "weight_logs": 0,
        "body_fat_logs": 0,
        "measurements": 0,
        "nutrition_logs": 0,
        "workouts": 0,
        "skipped": 0,
    }

    try:
        # ── Weight logs ──────────────────────────────────────────────
        existing_weight = {
            w.logged_at.date().isoformat()
            for w in db.query(WeightLog.logged_at).filter(WeightLog.user_id == current_user.id).all()
        }
        for row in (data.get("weight_logs") or []):
            d = _parse_date(row.get("date"))
            if d is None:
                counts["skipped"] += 1
                continue
            if d.isoformat() in existing_weight:
                counts["skipped"] += 1
                continue
            w_kg = _f(row.get("weight_kg"), 20, 500)
            if w_kg is None:
                counts["skipped"] += 1
                continue
            db.add(WeightLog(
                user_id=current_user.id,
                logged_at=datetime(d.year, d.month, d.day, tzinfo=timezone.utc),
                weight_kg=w_kg,
                notes=_str(row.get("notes")),
            ))
            counts["weight_logs"] += 1

        # ── Body fat logs ─────────────────────────────────────────────
        existing_fat = {
            f.logged_at.date().isoformat()
            for f in db.query(BodyFatLog.logged_at).filter(BodyFatLog.user_id == current_user.id).all()
        }
        for row in (data.get("body_fat_logs") or []):
            d = _parse_date(row.get("date"))
            if d is None or d.isoformat() in existing_fat:
                counts["skipped"] += 1
                continue
            pct = _f(row.get("body_fat_pct"), 1, 70)
            if pct is None:
                counts["skipped"] += 1
                continue
            db.add(BodyFatLog(
                user_id=current_user.id,
                logged_at=datetime(d.year, d.month, d.day, tzinfo=timezone.utc),
                body_fat_pct=pct,
                notes=_str(row.get("notes")),
            ))
            counts["body_fat_logs"] += 1

        # ── Measurements ──────────────────────────────────────────────
        existing_meas = {
            m.logged_at.date().isoformat()
            for m in db.query(MeasurementLog.logged_at).filter(MeasurementLog.user_id == current_user.id).all()
        }
        for row in (data.get("measurements") or []):
            d = _parse_date(row.get("date"))
            if d is None or d.isoformat() in existing_meas:
                counts["skipped"] += 1
                continue
            db.add(MeasurementLog(
                user_id=current_user.id,
                logged_at=datetime(d.year, d.month, d.day, tzinfo=timezone.utc),
                chest_cm=_f(row.get("chest_cm"), 20, 200),
                waist_cm=_f(row.get("waist_cm"), 20, 200),
                hips_cm=_f(row.get("hips_cm"), 20, 200),
                neck_cm=_f(row.get("neck_cm"), 10, 100),
                left_arm_cm=_f(row.get("left_arm_cm"), 10, 100),
                right_arm_cm=_f(row.get("right_arm_cm"), 10, 100),
                left_thigh_cm=_f(row.get("left_thigh_cm"), 20, 150),
                right_thigh_cm=_f(row.get("right_thigh_cm"), 20, 150),
            ))
            counts["measurements"] += 1

        # ── Nutrition logs ────────────────────────────────────────────
        existing_nutrition = {
            str(n.logged_date)
            for n in db.query(NutritionLog.logged_date).filter(NutritionLog.user_id == current_user.id).all()
        }
        for row in (data.get("nutrition_logs") or []):
            d = _parse_date(row.get("date"))
            if d is None or str(d) in existing_nutrition:
                counts["skipped"] += 1
                continue
            nl = NutritionLog(
                user_id=current_user.id,
                logged_date=d,
                total_calories=_f(row.get("total_calories"), 0, 30000),
                protein_g=_f(row.get("protein_g"), 0, 2000),
                carbs_g=_f(row.get("carbs_g"), 0, 2000),
                fat_g=_f(row.get("fat_g"), 0, 2000),
                water_ml=_f(row.get("water_ml"), 0, 20000),
                daily_notes=_str(row.get("daily_notes"), 1000),
            )
            db.add(nl)
            db.flush()  # get nl.id before adding food entries
            for fe_row in (row.get("food_entries") or []):
                meal = str(fe_row.get("meal_type", "snack")).lower()
                if meal not in _VALID_MEAL_TYPES:
                    meal = "snack"
                food_name = _str(fe_row.get("food_name"), 255)
                if not food_name:
                    continue
                db.add(FoodEntry(
                    nutrition_log_id=nl.id,
                    meal_type=meal,
                    food_name=food_name,
                    quantity_g=_f(fe_row.get("quantity_g"), 0, 10000),
                    calories=_f(fe_row.get("calories"), 0, 10000),
                    protein_g=_f(fe_row.get("protein_g"), 0, 1000),
                    carbs_g=_f(fe_row.get("carbs_g"), 0, 1000),
                    fat_g=_f(fe_row.get("fat_g"), 0, 1000),
                ))
            counts["nutrition_logs"] += 1

        # ── Workouts ──────────────────────────────────────────────────
        for row in (data.get("workouts") or []):
            d = _parse_date(row.get("date"))
            if d is None:
                counts["skipped"] += 1
                continue
            name = _str(row.get("name"), 255)
            if not name:
                counts["skipped"] += 1
                continue
            wk = Workout(
                user_id=current_user.id,
                logged_at=_parse_datetime(row.get("date")) or datetime(d.year, d.month, d.day, tzinfo=timezone.utc),
                name=name,
                duration_minutes=_i(row.get("duration_minutes"), 1, 600),
                notes=_str(row.get("notes")),
            )
            db.add(wk)
            db.flush()
            for ex_row in (row.get("exercises") or []):
                ex_name = _str(ex_row.get("exercise_name"), 255)
                if not ex_name:
                    continue
                db.add(WorkoutExercise(
                    workout_id=wk.id,
                    exercise_name=ex_name,
                    sets=_i(ex_row.get("sets"), 1, 100),
                    reps=_i(ex_row.get("reps"), 1, 10000),
                    weight_kg=_f(ex_row.get("weight_kg"), 0, 2000),
                    duration_seconds=_i(ex_row.get("duration_seconds"), 1, 86400),
                    notes=_str(ex_row.get("notes")),
                ))
            counts["workouts"] += 1

        db.commit()

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Import failed unexpectedly. No data was changed.",
        )

    total = sum(v for k, v in counts.items() if k != "skipped")
    return {"imported": counts, "total_imported": total}
