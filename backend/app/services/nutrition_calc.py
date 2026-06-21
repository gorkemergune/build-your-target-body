"""
Shared BMR / TDEE / macro calculation functions.

Used by the nutrition targets endpoint and the insight engine.
Formula: Mifflin-St Jeor BMR × activity multiplier.
"""
from datetime import date

_ACTIVITY_MULT: dict[str, float] = {
    "sedentary": 1.2,
    # canonical
    "lightly_active": 1.375,
    "moderately_active": 1.55,
    "very_active": 1.725,
    "extremely_active": 1.9,
    # old profile-page values (backward compat)
    "light": 1.375,
    "moderate": 1.55,
    "active": 1.725,
}

_PROTEIN_PER_KG: dict[str | None, float] = {
    "weight_loss": 2.2,
    "recomp": 2.4,
    "muscle_gain": 2.0,
    "weight_gain": 1.8,
    None: 1.8,
}


def calc_age(birth_date: date) -> int:
    today = date.today()
    return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))


def calc_bmr(weight_kg: float, height_cm: float, age: int, gender: str) -> float:
    base = 10 * weight_kg + 6.25 * height_cm - 5 * age
    return base + 5 if gender == "male" else base - 161


def calc_tdee(bmr: float, activity_level: str, training_days: int = 0) -> float:
    mult = _ACTIVITY_MULT.get(activity_level, 1.55)
    return bmr * mult + training_days * 30


def calc_macros(calories: int, weight_kg: float, goal_type: str | None) -> tuple[int, int, int]:
    """Returns (protein_g, carbs_g, fat_g)."""
    protein_per_kg = _PROTEIN_PER_KG.get(goal_type, 1.8)
    protein_g = round(weight_kg * protein_per_kg)

    fat_pct = 0.22 if calories < 2200 else 0.25
    fat_g = max(40, round(calories * fat_pct / 9))

    carbs_cals = max(0, calories - protein_g * 4 - fat_g * 9)
    carbs_g = round(carbs_cals / 4)

    return protein_g, carbs_g, fat_g
