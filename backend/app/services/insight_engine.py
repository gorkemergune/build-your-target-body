"""
Proactive AI Coach — Insight Engine.

Architecture:
  1. Deterministic rules detect conditions (no Gemini needed for facts/numbers).
  2. Gemini (optional) writes a 2-sentence personalized explanation.
  3. Each trigger_key is throttled to 1 insight per 3 days to avoid spamming.
"""
from datetime import date, datetime, timedelta, timezone
from dataclasses import dataclass
from typing import Optional

from sqlalchemy.orm import Session

from app.models.body_fat_log import BodyFatLog
from app.models.coach_insight import CoachInsight
from app.models.goal import Goal
from app.models.nutrition_log import NutritionLog
from app.services.gemini_client import call_gemini
from app.models.user import User
from app.models.weight_log import WeightLog
from app.models.workout import Workout
from app.services.nutrition_calc import calc_age, calc_bmr, calc_macros, calc_tdee

_THROTTLE_DAYS = 3


@dataclass
class _Detection:
    trigger_key: str
    category: str
    priority: str
    title_en: str
    title_tr: str
    fallback_en: str
    fallback_tr: str
    gemini_prompt: str  # English prompt describing the finding


def _avg(vals: list[float]) -> Optional[float]:
    return sum(vals) / len(vals) if vals else None


def _run_rules(user: User, db: Session) -> list[_Detection]:
    today = date.today()
    cutoff_7 = today - timedelta(days=7)
    cutoff_14 = today - timedelta(days=14)
    cutoff_21 = today - timedelta(days=21)
    cutoff_30 = today - timedelta(days=30)
    cutoff_60 = today - timedelta(days=60)

    # ── Fetch data ────────────────────────────────────────────────────────────
    all_weight = (
        db.query(WeightLog)
        .filter(WeightLog.user_id == user.id)
        .order_by(WeightLog.logged_at.asc())
        .all()
    )
    last_workout = (
        db.query(Workout)
        .filter(Workout.user_id == user.id)
        .order_by(Workout.logged_at.desc())
        .first()
    )
    nutrition_7d = (
        db.query(NutritionLog)
        .filter(NutritionLog.user_id == user.id, NutritionLog.logged_date >= cutoff_7)
        .all()
    )
    fat_logs_30 = (
        db.query(BodyFatLog)
        .filter(BodyFatLog.user_id == user.id, BodyFatLog.logged_at >= cutoff_30)
        .all()
    )
    fat_logs_prev30 = (
        db.query(BodyFatLog)
        .filter(BodyFatLog.user_id == user.id,
                BodyFatLog.logged_at >= cutoff_60,
                BodyFatLog.logged_at < cutoff_30)
        .all()
    )
    active_goal = (
        db.query(Goal)
        .filter(Goal.user_id == user.id, Goal.is_active == True)  # noqa: E712
        .first()
    )

    detections: list[_Detection] = []

    # ── Rule 1: No weight log for 7 days ─────────────────────────────────────
    last_weight_date = all_weight[-1].logged_at.date() if all_weight else None
    if last_weight_date is None or last_weight_date < cutoff_7:
        days_since = (today - last_weight_date).days if last_weight_date else 0
        detections.append(_Detection(
            trigger_key="no_weight_7d",
            category="consistency",
            priority="high",
            title_en="No Weight Log in 7 Days",
            title_tr="7 Gündür Kilo Kaydı Yok",
            fallback_en=(
                f"You haven't logged your weight in {days_since or 'several'} days. "
                "Daily weigh-ins are the single most powerful tool for staying accountable to your goal. "
                "Log your weight first thing tomorrow morning."
            ),
            fallback_tr=(
                f"{days_since or 'birkaç'} gündür kilo kaydı girmediniz. "
                "Her gün kilo takibi, hedefinize sadık kalmanın en güçlü yoludur. "
                "Yarın sabah kalkar kalkmaz kilonuzu girin."
            ),
            gemini_prompt=(
                f"The user hasn't logged their weight for {days_since or 'several'} days. "
                "In 2 sentences, motivate them to resume daily weigh-ins and explain why consistency matters."
            ),
        ))

    # ── Rule 2: No workout for 7 days ────────────────────────────────────────
    last_workout_date = last_workout.logged_at.date() if last_workout else None
    if last_workout_date is None or last_workout_date < cutoff_7:
        days_since_wo = (today - last_workout_date).days if last_workout_date else 0
        detections.append(_Detection(
            trigger_key="no_workout_7d",
            category="workouts",
            priority="high",
            title_en="No Workout in 7 Days",
            title_tr="7 Gündür Antrenman Yok",
            fallback_en=(
                f"You haven't logged a workout in {days_since_wo or 'several'} days. "
                "Consistency is the key driver of body transformation. "
                "Even a 20-minute session today will get you back on track."
            ),
            fallback_tr=(
                f"{days_since_wo or 'birkaç'} gündür antrenman kaydı yok. "
                "Tutarlılık, vücut dönüşümünün temel motorudur. "
                "Bugün 20 dakikalık bir antrenman bile sizi yolunuza döndürür."
            ),
            gemini_prompt=(
                f"The user hasn't done a workout in {days_since_wo or 'several'} days. "
                "In 2 sentences, encourage them to return to training with a practical first step."
            ),
        ))

    # ── Rule 3: Protein consistently low ────────────────────────────────────
    protein_vals = [n.protein_g for n in nutrition_7d if n.protein_g is not None]
    if len(protein_vals) >= 3:
        avg_protein = _avg(protein_vals)
        if avg_protein is not None and avg_protein < 100:
            detections.append(_Detection(
                trigger_key="low_protein",
                category="nutrition",
                priority="medium",
                title_en="Protein Intake Consistently Low",
                title_tr="Protein Alımı Sürekli Düşük",
                fallback_en=(
                    f"Your average protein intake over the last 7 days is {round(avg_protein)}g — "
                    "below the recommended minimum of 100g for body composition goals. "
                    "Aim to add a protein source (chicken, eggs, Greek yogurt) to every meal."
                ),
                fallback_tr=(
                    f"Son 7 günde ortalama protein alımınız {round(avg_protein)}g — "
                    "vücut kompozisyonu hedefleri için önerilen minimum 100g'ın altında. "
                    "Her öğüne bir protein kaynağı (tavuk, yumurta, yoğurt) eklemeyi hedefleyin."
                ),
                gemini_prompt=(
                    f"The user's average protein intake is only {round(avg_protein)}g/day over the last 7 days. "
                    "In 2 sentences, explain why adequate protein matters for their goal and give one practical tip."
                ),
            ))

    # ── Rule 4: Plateau (14-day major) ──────────────────────────────────────
    p14 = [w.weight_kg for w in all_weight if w.logged_at.date() >= cutoff_14]
    if len(p14) >= 4:
        r14 = round(max(p14) - min(p14), 2)
        if r14 < 0.5:
            detections.append(_Detection(
                trigger_key="plateau_14d",
                category="plateau",
                priority="high",
                title_en="Weight Plateau Detected",
                title_tr="Kilo Platosу Tespit Edildi",
                fallback_en=(
                    f"Your weight has varied by only {r14} kg over the last 14 days. "
                    "A plateau usually means your body has adapted — try adjusting calories by 100–200 kcal "
                    "or changing your workout structure."
                ),
                fallback_tr=(
                    f"Son 14 günde kilonuz yalnızca {r14} kg değişti. "
                    "Plato genellikle vücudunuzun adapte olduğu anlamına gelir — "
                    "kaloriyi 100–200 kcal ayarlamayı veya antrenman yapınızı değiştirmeyi deneyin."
                ),
                gemini_prompt=(
                    f"The user's weight has only varied by {r14} kg over 14 days with at least 4 weigh-ins. "
                    "In 2 sentences, explain what a plateau means and suggest one specific strategy to break it."
                ),
            ))

    # ── Rule 5: Ahead of schedule ────────────────────────────────────────────
    # ── Rule 6: Behind schedule ──────────────────────────────────────────────
    if active_goal and all_weight and active_goal.target_weight_kg and active_goal.target_date:
        latest_w = all_weight[-1].weight_kg
        start_w = active_goal.start_weight_kg or all_weight[0].weight_kg
        total_needed = active_goal.target_weight_kg - start_w
        current_change = latest_w - start_w

        if total_needed != 0:
            progress_pct = (current_change / total_needed) * 100

            # ETA via weekly rate
            w_last7 = [w.weight_kg for w in all_weight if w.logged_at.date() >= cutoff_7]
            w_prev7 = [w.weight_kg for w in all_weight if cutoff_14 <= w.logged_at.date() < cutoff_7]
            weekly_change = None
            if w_last7 and w_prev7:
                avg_l = _avg(w_last7)
                avg_p = _avg(w_prev7)
                if avg_l is not None and avg_p is not None:
                    weekly_change = avg_l - avg_p

            if weekly_change and weekly_change != 0:
                remaining = active_goal.target_weight_kg - latest_w
                weeks_needed = remaining / weekly_change
                if weeks_needed > 0:
                    eta_d = today + timedelta(weeks=weeks_needed)
                    target_d = active_goal.target_date.date()
                    days_ahead = (target_d - eta_d).days

                    if days_ahead >= 14:
                        detections.append(_Detection(
                            trigger_key="ahead_schedule",
                            category="progress",
                            priority="low",
                            title_en="Ahead of Schedule",
                            title_tr="Programın Önündesiniz",
                            fallback_en=(
                                f"You're about {days_ahead} days ahead of your target date. "
                                "Your current rate of progress is excellent. "
                                "Keep the habits that got you here."
                            ),
                            fallback_tr=(
                                f"Hedef tarihinizin yaklaşık {days_ahead} gün önündesiniz. "
                                "Mevcut ilerleme hızınız mükemmel. "
                                "Sizi buraya getiren alışkanlıkları sürdürün."
                            ),
                            gemini_prompt=(
                                f"The user is {days_ahead} days ahead of schedule, progress {round(progress_pct)}%. "
                                "In 2 sentences, celebrate this achievement and give advice on maintaining momentum."
                            ),
                        ))
                    elif days_ahead <= -14:
                        detections.append(_Detection(
                            trigger_key="behind_schedule",
                            category="progress",
                            priority="high",
                            title_en="Behind Schedule",
                            title_tr="Programın Gerisinde",
                            fallback_en=(
                                f"At your current rate you'll reach your goal about {abs(days_ahead)} days late. "
                                "Consider tightening your nutrition by 100–200 kcal/day "
                                "or adding one extra workout per week."
                            ),
                            fallback_tr=(
                                f"Mevcut hızınızla hedefinize yaklaşık {abs(days_ahead)} gün geç ulaşacaksınız. "
                                "Beslenmenizi günde 100–200 kcal kısıtlamayı "
                                "veya haftada bir antrenman daha eklemeyi düşünün."
                            ),
                            gemini_prompt=(
                                f"The user is {abs(days_ahead)} days behind their target date, "
                                f"progress {round(progress_pct)}%. "
                                "In 2 sentences, explain the situation constructively and give one actionable adjustment."
                            ),
                        ))

            # ── Rule 10: Goal nearly reached ─────────────────────────────
            if progress_pct >= 90:
                detections.append(_Detection(
                    trigger_key="goal_nearly_reached",
                    category="progress",
                    priority="high",
                    title_en="Almost at Your Goal!",
                    title_tr="Hedefinize Neredeyse Ulaştınız!",
                    fallback_en=(
                        f"You're {round(progress_pct)}% of the way to your goal — incredible work! "
                        "You're in the final stretch. Stay consistent and you'll cross the finish line soon."
                    ),
                    fallback_tr=(
                        f"Hedefinizin %{round(progress_pct)}'ine ulaştınız — inanılmaz bir başarı! "
                        "Son düzlüktesiniz. Tutarlı kalırsanız çok yakında hedefinize ulaşacaksınız."
                    ),
                    gemini_prompt=(
                        f"The user has reached {round(progress_pct)}% of their goal. "
                        "In 2 sentences, strongly celebrate this and give advice for the final push."
                    ),
                ))

    # ── Rule 7: Consistency improving ────────────────────────────────────────
    # ── Rule 8: Consistency declining ────────────────────────────────────────
    def _activity_days(cutoff_start: date, cutoff_end: date) -> int:
        days: set[date] = set()
        for (d,) in db.query(WeightLog.logged_at).filter(
            WeightLog.user_id == user.id,
            WeightLog.logged_at >= cutoff_start,
            WeightLog.logged_at < cutoff_end,
        ).all():
            days.add(d.date() if hasattr(d, "date") else d)
        for (d,) in db.query(NutritionLog.logged_date).filter(
            NutritionLog.user_id == user.id,
            NutritionLog.logged_date >= cutoff_start,
            NutritionLog.logged_date < cutoff_end,
        ).all():
            days.add(d)
        for (d,) in db.query(Workout.logged_at).filter(
            Workout.user_id == user.id,
            Workout.logged_at >= cutoff_start,
            Workout.logged_at < cutoff_end,
        ).all():
            days.add(d.date() if hasattr(d, "date") else d)
        return len(days)

    cutoff_28 = today - timedelta(days=28)
    recent_14 = _activity_days(cutoff_14, today)
    prev_14 = _activity_days(cutoff_28, cutoff_14)

    if prev_14 >= 3:
        diff = recent_14 - prev_14
        if diff >= 4:
            detections.append(_Detection(
                trigger_key="consistency_improving",
                category="consistency",
                priority="low",
                title_en="Consistency Is Improving",
                title_tr="Tutarlılığınız Artıyor",
                fallback_en=(
                    f"Your active days increased from {prev_14} to {recent_14} over the past two weeks. "
                    "This upward trend in consistency is one of the best predictors of long-term success. "
                    "Keep building the streak!"
                ),
                fallback_tr=(
                    f"Aktif günleriniz son iki haftada {prev_14}'ten {recent_14}'e yükseldi. "
                    "Tutarlılıktaki bu artış, uzun vadeli başarının en güçlü göstergelerinden biridir. "
                    "Seriyi sürdürmeye devam edin!"
                ),
                gemini_prompt=(
                    f"The user improved their active tracking days from {prev_14} to {recent_14} in 14 days. "
                    "In 2 sentences, acknowledge this improvement and encourage them to keep it up."
                ),
            ))
        elif diff <= -4:
            detections.append(_Detection(
                trigger_key="consistency_declining",
                category="consistency",
                priority="medium",
                title_en="Consistency Is Declining",
                title_tr="Tutarlılığınız Düşüyor",
                fallback_en=(
                    f"Your active days dropped from {prev_14} to {recent_14} over the past two weeks. "
                    "Inconsistent tracking makes it hard to see what's working. "
                    "Try setting a daily reminder at a fixed time."
                ),
                fallback_tr=(
                    f"Aktif günleriniz son iki haftada {prev_14}'ten {recent_14}'e düştü. "
                    "Tutarsız takip, neyin işe yaradığını görmeyi zorlaştırır. "
                    "Sabit bir saatte günlük hatırlatıcı kurmayı deneyin."
                ),
                gemini_prompt=(
                    f"The user's active tracking days dropped from {prev_14} to {recent_14} over two weeks. "
                    "In 2 sentences, compassionately address the decline and give one concrete re-engagement tip."
                ),
            ))

    # ── Rule 9: Body fat decreasing faster than expected ────────────────────
    if len(fat_logs_30) >= 2 and len(fat_logs_prev30) >= 2:
        recent_avg_fat = _avg([f.body_fat_pct for f in fat_logs_30])
        prev_avg_fat = _avg([f.body_fat_pct for f in fat_logs_prev30])
        if recent_avg_fat is not None and prev_avg_fat is not None:
            monthly_fat_drop = prev_avg_fat - recent_avg_fat
            if monthly_fat_drop > 2.0:
                detections.append(_Detection(
                    trigger_key="fast_fat_loss",
                    category="body_fat",
                    priority="medium",
                    title_en="Body Fat Dropping Fast",
                    title_tr="Vücut Yağı Hızla Düşüyor",
                    fallback_en=(
                        f"Your body fat dropped by {round(monthly_fat_drop, 1)}% in the last 30 days. "
                        "While progress is great, drops above 1.5%/month can risk muscle loss. "
                        "Ensure you're eating enough protein and not cutting calories too aggressively."
                    ),
                    fallback_tr=(
                        f"Vücut yağınız son 30 günde {round(monthly_fat_drop, 1)}% düştü. "
                        "İlerleme harika olsa da aylık 1.5%'in üzerindeki düşüşler kas kaybına yol açabilir. "
                        "Yeterince protein yediğinizden ve kaloriyi çok agresif kısmadığınızdan emin olun."
                    ),
                    gemini_prompt=(
                        f"The user lost {round(monthly_fat_drop, 1)}% body fat in 30 days (fast). "
                        "In 2 sentences, acknowledge the success but explain the muscle-loss risk and one mitigation."
                    ),
                ))

    # ── Rules 10-12: Personalized nutrition (requires profile) ──────────────
    if (
        user.gender and user.birth_date and user.height_cm
        and user.activity_level and all_weight
    ):
        try:
            age = calc_age(user.birth_date.date() if hasattr(user.birth_date, "date") else user.birth_date)
            bmr = calc_bmr(all_weight[-1].weight_kg, user.height_cm, age, user.gender)
            tdee_val = calc_tdee(bmr, user.activity_level)
            goal_type = active_goal.goal_type if active_goal else None

            if goal_type in ("weight_loss", "recomp"):
                target_cal = max(1200, round(tdee_val - 500))
            elif goal_type in ("weight_gain", "muscle_gain"):
                target_cal = round(tdee_val + 350)
            else:
                target_cal = round(tdee_val)

            protein_target, _, _ = calc_macros(target_cal, all_weight[-1].weight_kg, goal_type)

            # Rule 10: Protein below personal target ──────────────────────────
            logged_protein = [n.protein_g for n in nutrition_7d if n.protein_g is not None]
            if len(logged_protein) >= 3:
                avg_prot = sum(logged_protein) / len(logged_protein)
                if avg_prot < protein_target * 0.75:
                    detections.append(_Detection(
                        trigger_key="low_protein_vs_target",
                        category="nutrition",
                        priority="medium",
                        title_en="Protein Below Your Personal Target",
                        title_tr="Protein Hedefinin Altında",
                        fallback_en=(
                            f"Your 7-day average protein is {round(avg_prot)}g — "
                            f"your personal target is {protein_target}g based on your weight and goal. "
                            "Prioritise lean protein at every meal to protect muscle mass."
                        ),
                        fallback_tr=(
                            f"7 günlük ortalama proteinin {round(avg_prot)}g — "
                            f"kilonuz ve hedefinize göre kişisel hedefin {protein_target}g. "
                            "Kas kitlesini korumak için her öğünde yağsız protein önceliğin olsun."
                        ),
                        gemini_prompt=(
                            f"User's 7-day avg protein is {round(avg_prot)}g vs personal target of {protein_target}g "
                            f"(goal: {goal_type}, weight: {all_weight[-1].weight_kg}kg). "
                            "In 2 sentences, explain the impact and give one practical fix."
                        ),
                    ))

            # Rule 11: Calorie surplus on weight-loss goal ────────────────────
            if goal_type in ("weight_loss", "recomp"):
                logged_cals = [n.total_calories for n in nutrition_7d if n.total_calories is not None]
                if len(logged_cals) >= 3:
                    avg_cal = sum(logged_cals) / len(logged_cals)
                    if avg_cal > target_cal * 1.15:
                        over = round(avg_cal - target_cal)
                        detections.append(_Detection(
                            trigger_key="calorie_surplus_loss_goal",
                            category="nutrition",
                            priority="high",
                            title_en="Exceeding Calorie Target",
                            title_tr="Kalori Hedefi Aşılıyor",
                            fallback_en=(
                                f"You've been averaging {round(avg_cal)} kcal — "
                                f"about {over} kcal above your {target_cal} kcal target. "
                                "This surplus may be slowing your weight loss progress."
                            ),
                            fallback_tr=(
                                f"Ortalama {round(avg_cal)} kcal tüketiyorsunuz — "
                                f"hedefin {target_cal} kcal'in yaklaşık {over} kcal üzerinde. "
                                "Bu fazlalık kilo verme ilerlemenizi yavaşlatıyor olabilir."
                            ),
                            gemini_prompt=(
                                f"User is averaging {round(avg_cal)} kcal vs a target of {target_cal} kcal "
                                f"(goal: {goal_type}). In 2 sentences, explain the impact and suggest one habit fix."
                            ),
                        ))

            # Rule 12: Extreme calorie deficit ────────────────────────────────
            logged_cals_all = [n.total_calories for n in nutrition_7d if n.total_calories is not None]
            if len(logged_cals_all) >= 2:
                avg_cal_all = sum(logged_cals_all) / len(logged_cals_all)
                floor = 1500 if user.gender == "male" else 1200
                if avg_cal_all < floor * 0.85:
                    detections.append(_Detection(
                        trigger_key="extreme_calorie_deficit",
                        category="nutrition",
                        priority="high",
                        title_en="Calorie Intake Very Low",
                        title_tr="Kalori Alımı Çok Düşük",
                        fallback_en=(
                            f"Your average calorie intake ({round(avg_cal_all)} kcal) is well below safe minimums. "
                            "Very low intakes can cause muscle loss and metabolic adaptation. "
                            f"Aim for at least {floor} kcal/day."
                        ),
                        fallback_tr=(
                            f"Ortalama kalori alımınız ({round(avg_cal_all)} kcal) güvenli minimumların çok altında. "
                            "Çok düşük alım kas kaybına ve metabolik adaptasyona yol açabilir. "
                            f"Günde en az {floor} kcal hedefleyin."
                        ),
                        gemini_prompt=(
                            f"User is averaging only {round(avg_cal_all)} kcal/day (gender: {user.gender}, "
                            f"floor: {floor} kcal). In 2 sentences, explain the risks and urge safe calorie intake."
                        ),
                    ))
        except Exception:
            pass  # profile incomplete or calc error — skip nutrition rules silently

    return detections


async def _explain_with_gemini(prompt: str, lang: str, fallback: str) -> str:
    lang_instruction = "Respond in Turkish." if lang == "tr" else "Respond in English."
    full = (
        f"You are a fitness coach writing a proactive insight for a user's coaching feed. "
        f"{lang_instruction} Be warm, specific, and actionable. Keep it to 2–3 sentences.\n\n"
        f"Finding: {prompt}"
    )
    return await call_gemini(full, prompt_type="coach_insight", timeout_s=15.0, fallback=fallback)


def _already_generated(user_id: int, trigger_key: str, db: Session) -> bool:
    cutoff = datetime.now(timezone.utc) - timedelta(days=_THROTTLE_DAYS)
    return (
        db.query(CoachInsight)
        .filter(
            CoachInsight.user_id == user_id,
            CoachInsight.trigger_key == trigger_key,
            CoachInsight.created_at >= cutoff,
        )
        .first()
    ) is not None


async def generate_insights_for_user(user: User, db: Session) -> list[CoachInsight]:
    lang = user.preferred_language or "en"
    detections = _run_rules(user, db)

    new_insights: list[CoachInsight] = []
    for det in detections:
        if _already_generated(user.id, det.trigger_key, db):
            continue

        fallback = det.fallback_tr if lang == "tr" else det.fallback_en
        title = det.title_tr if lang == "tr" else det.title_en
        content = await _explain_with_gemini(det.gemini_prompt, lang, fallback)

        insight = CoachInsight(
            user_id=user.id,
            category=det.category,
            priority=det.priority,
            title=title,
            content=content,
            trigger_key=det.trigger_key,
        )
        db.add(insight)
        new_insights.append(insight)

    if new_insights:
        db.commit()
        for ins in new_insights:
            db.refresh(ins)

    return new_insights
