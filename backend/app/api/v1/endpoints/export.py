import csv
import io
import json
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user, get_db
from app.models.ai_report import AiReport
from app.models.body_fat_log import BodyFatLog
from app.models.goal import Goal
from app.models.measurement_log import MeasurementLog
from app.models.nutrition_log import FoodEntry, NutritionLog
from app.models.progress_photo import ProgressPhoto
from app.models.user import User
from app.models.weight_log import WeightLog
from app.models.workout import Workout

router = APIRouter(prefix="/export", tags=["export"])

UPLOAD_DIR = Path("uploads/progress_photos")


def _collect_user_data(user: User, db: Session) -> dict:
    weight_logs = (
        db.query(WeightLog)
        .filter(WeightLog.user_id == user.id)
        .order_by(WeightLog.logged_at.asc())
        .all()
    )
    fat_logs = (
        db.query(BodyFatLog)
        .filter(BodyFatLog.user_id == user.id)
        .order_by(BodyFatLog.logged_at.asc())
        .all()
    )
    measurements = (
        db.query(MeasurementLog)
        .filter(MeasurementLog.user_id == user.id)
        .order_by(MeasurementLog.logged_at.asc())
        .all()
    )
    nutrition_logs = (
        db.query(NutritionLog)
        .options(joinedload(NutritionLog.food_entries))
        .filter(NutritionLog.user_id == user.id)
        .order_by(NutritionLog.logged_date.asc())
        .all()
    )
    workouts = (
        db.query(Workout)
        .options(joinedload(Workout.exercises))
        .filter(Workout.user_id == user.id)
        .order_by(Workout.logged_at.asc())
        .all()
    )
    goals = db.query(Goal).filter(Goal.user_id == user.id).all()
    photos = (
        db.query(ProgressPhoto)
        .filter(ProgressPhoto.user_id == user.id)
        .order_by(ProgressPhoto.uploaded_at.asc())
        .all()
    )
    reports = (
        db.query(AiReport)
        .filter(AiReport.user_id == user.id)
        .order_by(AiReport.generated_at.asc())
        .all()
    )

    return {
        "export_version": "1",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "profile": {
            "email": user.email,
            "full_name": user.full_name,
            "gender": user.gender,
            "height_cm": user.height_cm,
            "activity_level": user.activity_level,
            "preferred_language": user.preferred_language,
        },
        "goals": [
            {
                "goal_type": g.goal_type,
                "start_weight_kg": g.start_weight_kg,
                "target_weight_kg": g.target_weight_kg,
                "start_body_fat_pct": g.start_body_fat_pct,
                "target_body_fat_pct": g.target_body_fat_pct,
                "target_date": g.target_date.isoformat() if g.target_date else None,
                "is_active": g.is_active,
                "created_at": g.created_at.isoformat() if g.created_at else None,
            }
            for g in goals
        ],
        "weight_logs": [
            {
                "date": w.logged_at.isoformat(),
                "weight_kg": w.weight_kg,
                "notes": w.notes,
            }
            for w in weight_logs
        ],
        "body_fat_logs": [
            {
                "date": f.logged_at.isoformat(),
                "body_fat_pct": f.body_fat_pct,
                "notes": f.notes,
            }
            for f in fat_logs
        ],
        "measurements": [
            {
                "date": m.logged_at.isoformat(),
                "chest_cm": m.chest_cm,
                "waist_cm": m.waist_cm,
                "hips_cm": m.hips_cm,
                "neck_cm": m.neck_cm,
                "left_arm_cm": m.left_arm_cm,
                "right_arm_cm": m.right_arm_cm,
                "left_thigh_cm": m.left_thigh_cm,
                "right_thigh_cm": m.right_thigh_cm,
            }
            for m in measurements
        ],
        "nutrition_logs": [
            {
                "date": n.logged_date.isoformat(),
                "total_calories": n.total_calories,
                "protein_g": n.protein_g,
                "carbs_g": n.carbs_g,
                "fat_g": n.fat_g,
                "water_ml": n.water_ml,
                "daily_notes": n.daily_notes,
                "food_entries": [
                    {
                        "meal_type": fe.meal_type,
                        "food_name": fe.food_name,
                        "quantity_g": fe.quantity_g,
                        "calories": fe.calories,
                        "protein_g": fe.protein_g,
                        "carbs_g": fe.carbs_g,
                        "fat_g": fe.fat_g,
                    }
                    for fe in (n.food_entries or [])
                ],
            }
            for n in nutrition_logs
        ],
        "workouts": [
            {
                "date": w.logged_at.isoformat(),
                "name": w.name,
                "duration_minutes": w.duration_minutes,
                "notes": w.notes,
                "exercises": [
                    {
                        "exercise_name": ex.exercise_name,
                        "sets": ex.sets,
                        "reps": ex.reps,
                        "weight_kg": ex.weight_kg,
                        "duration_seconds": ex.duration_seconds,
                        "notes": ex.notes,
                    }
                    for ex in (w.exercises or [])
                ],
            }
            for w in workouts
        ],
        "photos": [
            {
                "uploaded_at": p.uploaded_at.isoformat(),
                "image_path": p.image_path,
                "weight_kg": p.weight_kg,
                "body_fat_pct": p.body_fat_pct,
                "note": p.note,
            }
            for p in photos
        ],
        "ai_reports": [
            {
                "type": r.type,
                "title": r.title,
                "content": r.content,
                "generated_at": r.generated_at.isoformat(),
            }
            for r in reports
        ],
    }


@router.get("/json")
def export_json(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = _collect_user_data(current_user, db)
    content = json.dumps(data, ensure_ascii=False, indent=2, default=str)
    today = datetime.now().strftime("%Y-%m-%d")
    return Response(
        content=content.encode("utf-8"),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="bytb_export_{today}.json"'},
    )


def _build_csv_zip(data: dict) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        # weight.csv
        w_buf = io.StringIO()
        w = csv.writer(w_buf)
        w.writerow(["date", "weight_kg", "notes"])
        for row in data.get("weight_logs", []):
            w.writerow([row["date"][:10], row["weight_kg"], row.get("notes") or ""])
        zf.writestr("weight.csv", w_buf.getvalue())

        # body_fat.csv
        bf_buf = io.StringIO()
        w = csv.writer(bf_buf)
        w.writerow(["date", "body_fat_pct", "notes"])
        for row in data.get("body_fat_logs", []):
            w.writerow([row["date"][:10], row["body_fat_pct"], row.get("notes") or ""])
        zf.writestr("body_fat.csv", bf_buf.getvalue())

        # measurements.csv
        m_buf = io.StringIO()
        w = csv.writer(m_buf)
        w.writerow([
            "date", "chest_cm", "waist_cm", "hips_cm", "neck_cm",
            "left_arm_cm", "right_arm_cm", "left_thigh_cm", "right_thigh_cm",
        ])
        for row in data.get("measurements", []):
            w.writerow([
                row["date"][:10],
                row.get("chest_cm") or "",
                row.get("waist_cm") or "",
                row.get("hips_cm") or "",
                row.get("neck_cm") or "",
                row.get("left_arm_cm") or "",
                row.get("right_arm_cm") or "",
                row.get("left_thigh_cm") or "",
                row.get("right_thigh_cm") or "",
            ])
        zf.writestr("measurements.csv", m_buf.getvalue())

        # nutrition.csv
        n_buf = io.StringIO()
        w = csv.writer(n_buf)
        w.writerow(["date", "calories", "protein_g", "carbs_g", "fat_g", "water_ml", "notes"])
        for row in data.get("nutrition_logs", []):
            w.writerow([
                row["date"],
                row.get("total_calories") or "",
                row.get("protein_g") or "",
                row.get("carbs_g") or "",
                row.get("fat_g") or "",
                row.get("water_ml") or "",
                row.get("daily_notes") or "",
            ])
        zf.writestr("nutrition.csv", n_buf.getvalue())

        # workouts.csv
        wk_buf = io.StringIO()
        w = csv.writer(wk_buf)
        w.writerow(["date", "workout_name", "duration_minutes", "exercise", "sets", "reps", "weight_kg", "notes"])
        for row in data.get("workouts", []):
            exercises = row.get("exercises") or []
            if exercises:
                for ex in exercises:
                    w.writerow([
                        row["date"][:10],
                        row["name"],
                        row.get("duration_minutes") or "",
                        ex.get("exercise_name") or "",
                        ex.get("sets") or "",
                        ex.get("reps") or "",
                        ex.get("weight_kg") or "",
                        ex.get("notes") or "",
                    ])
            else:
                w.writerow([
                    row["date"][:10],
                    row["name"],
                    row.get("duration_minutes") or "",
                    "", "", "", "", row.get("notes") or "",
                ])
        zf.writestr("workouts.csv", wk_buf.getvalue())

    buf.seek(0)
    return buf.read()


@router.get("/csv")
def export_csv(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = _collect_user_data(current_user, db)
    zip_bytes = _build_csv_zip(data)
    today = datetime.now().strftime("%Y-%m-%d")
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="bytb_csv_{today}.zip"'},
    )


@router.get("/full-backup")
def export_full_backup(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = _collect_user_data(current_user, db)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("data.json", json.dumps(data, ensure_ascii=False, indent=2, default=str))
        for photo in data.get("photos", []):
            photo_file = UPLOAD_DIR / photo["image_path"]
            if photo_file.exists():
                zf.write(photo_file, f"photos/{photo['image_path']}")
    buf.seek(0)
    today = datetime.now().strftime("%Y-%m-%d")
    return Response(
        content=buf.read(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="bytb_backup_{today}.zip"'},
    )
