import random
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.nutrition_log import NutritionLog
from app.models.weight_log import WeightLog
from app.models.workout import Workout, WorkoutExercise

router = APIRouter(prefix="/demo", tags=["demo"])

_WORKOUT_TEMPLATES = [
    ("Upper Body A", 60, [
        ("Bench Press", 4, 8, 80.0),
        ("Pull-ups", 4, 10, 0.0),
        ("Overhead Press", 3, 10, 50.0),
        ("Barbell Row", 4, 8, 70.0),
    ]),
    ("Lower Body A", 50, [
        ("Squat", 4, 8, 100.0),
        ("Romanian Deadlift", 3, 10, 80.0),
        ("Leg Press", 3, 12, 150.0),
        ("Calf Raises", 4, 15, 60.0),
    ]),
    ("Upper Body B", 55, [
        ("Incline Press", 4, 10, 70.0),
        ("Cable Row", 4, 12, 60.0),
        ("Lateral Raises", 3, 15, 12.0),
        ("Bicep Curl", 3, 12, 20.0),
        ("Tricep Pushdown", 3, 12, 25.0),
    ]),
    ("Lower Body B", 50, [
        ("Deadlift", 3, 6, 120.0),
        ("Bulgarian Split Squat", 3, 10, 30.0),
        ("Leg Extension", 3, 15, 50.0),
        ("Leg Curl", 3, 12, 45.0),
    ]),
]


@router.post("/generate", status_code=status.HTTP_201_CREATED)
def generate_demo_data(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = date.today()
    rng = random.Random(current_user.id * 137)
    start_weight = rng.uniform(80.0, 95.0)

    # 60 days of weight logs
    for i in range(60):
        day = today - timedelta(days=59 - i)
        w = round(start_weight - (i * 0.04) + rng.uniform(-0.5, 0.5), 1)
        db.add(WeightLog(
            user_id=current_user.id,
            weight_kg=max(50.0, w),
            logged_at=datetime(day.year, day.month, day.day, 8, 0, 0, tzinfo=timezone.utc),
        ))

    # 60 days of nutrition logs
    for i in range(60):
        day = today - timedelta(days=59 - i)
        db.add(NutritionLog(
            user_id=current_user.id,
            logged_date=day,
            total_calories=round(rng.uniform(1850, 2350)),
            protein_g=round(rng.uniform(130, 175)),
            carbs_g=round(rng.uniform(160, 260)),
            fat_g=round(rng.uniform(55, 90)),
            water_ml=round(rng.uniform(1600, 3000)),
        ))

    # 30 workouts (every other day)
    for i in range(30):
        day_offset = 59 - (i * 2)
        day = today - timedelta(days=day_offset)
        name, base_duration, exercises = _WORKOUT_TEMPLATES[i % len(_WORKOUT_TEMPLATES)]
        workout = Workout(
            user_id=current_user.id,
            name=name,
            logged_at=datetime(day.year, day.month, day.day, 17, 0, 0, tzinfo=timezone.utc),
            duration_minutes=base_duration + rng.randint(-10, 10),
        )
        db.add(workout)
        db.flush()
        for ex_name, sets, reps, base_ex_weight in exercises:
            db.add(WorkoutExercise(
                workout_id=workout.id,
                exercise_name=ex_name,
                sets=sets,
                reps=reps,
                weight_kg=round(base_ex_weight + rng.uniform(-5, 5), 1) if base_ex_weight > 0 else None,
            ))

    db.commit()
    return {"message": "Demo data generated", "days": 60, "workouts": 30}
