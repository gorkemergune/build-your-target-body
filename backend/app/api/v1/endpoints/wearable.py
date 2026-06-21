import os
from base64 import b64encode
from datetime import date, datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.health_sync import HealthSyncLog
from app.models.wearable import WearableConnection
from app.models.workout import Workout
from app.models.user import User
from app.schemas.wearable import (
    ReadinessScore,
    RecoveryScore,
    WearableConnectRequest,
    WearableConnectionResponse,
    WearableFitbitExchangeRequest,
    WearableScoresResponse,
)

router = APIRouter(prefix="/wearable", tags=["wearable"])

FITBIT_CLIENT_ID = os.getenv("FITBIT_CLIENT_ID", "")
FITBIT_CLIENT_SECRET = os.getenv("FITBIT_CLIENT_SECRET", "")
FITBIT_TOKEN_URL = "https://api.fitbit.com/oauth2/token"
FITBIT_API_BASE = "https://api.fitbit.com"


# ── Connections ────────────────────────────────────────────────────────────────

@router.get("/connections", response_model=list[WearableConnectionResponse])
def list_connections(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(WearableConnection)
        .filter(
            WearableConnection.user_id == current_user.id,
            WearableConnection.is_connected == True,  # noqa: E712
        )
        .order_by(WearableConnection.connected_at.desc())
        .all()
    )


@router.post("/connect", response_model=WearableConnectionResponse, status_code=status.HTTP_201_CREATED)
def connect_wearable(
    payload: WearableConnectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a wearable as connected. For Apple Watch and Garmin this is a manual flag."""
    existing = (
        db.query(WearableConnection)
        .filter(
            WearableConnection.user_id == current_user.id,
            WearableConnection.platform == payload.platform,
        )
        .first()
    )
    if existing:
        existing.is_connected = True
        existing.display_name = payload.display_name or existing.display_name
        existing.connected_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing)
        return existing

    conn = WearableConnection(
        user_id=current_user.id,
        platform=payload.platform,
        is_connected=True,
        display_name=payload.display_name,
        connected_at=datetime.now(timezone.utc),
    )
    db.add(conn)
    db.commit()
    db.refresh(conn)
    return conn


@router.delete("/connect/{platform}", status_code=status.HTTP_204_NO_CONTENT)
def disconnect_wearable(
    platform: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conn = (
        db.query(WearableConnection)
        .filter(
            WearableConnection.user_id == current_user.id,
            WearableConnection.platform == platform,
        )
        .first()
    )
    if conn:
        conn.is_connected = False
        conn.access_token = None
        conn.refresh_token = None
        db.commit()


# ── Fitbit OAuth ───────────────────────────────────────────────────────────────

@router.get("/fitbit/auth-url")
def fitbit_auth_url(
    redirect_uri: str,
    current_user: User = Depends(get_current_user),
):
    """Return the Fitbit authorization URL for the client to open in a browser."""
    if not FITBIT_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Fitbit integration not configured (FITBIT_CLIENT_ID missing).",
        )
    import urllib.parse
    state = f"{current_user.id}:{datetime.now(timezone.utc).timestamp()}"
    params = {
        "response_type": "code",
        "client_id": FITBIT_CLIENT_ID,
        "scope": "activity heartrate profile",
        "redirect_uri": redirect_uri,
        "state": state,
    }
    url = "https://www.fitbit.com/oauth2/authorize?" + urllib.parse.urlencode(params)
    return {"auth_url": url, "state": state}


@router.post("/fitbit/exchange", response_model=WearableConnectionResponse)
async def fitbit_exchange(
    payload: WearableFitbitExchangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Exchange Fitbit authorization code for tokens and mark as connected."""
    if not FITBIT_CLIENT_ID or not FITBIT_CLIENT_SECRET:
        raise HTTPException(status_code=503, detail="Fitbit integration not configured.")

    credentials = b64encode(f"{FITBIT_CLIENT_ID}:{FITBIT_CLIENT_SECRET}".encode()).decode()
    form_data = {
        "grant_type": "authorization_code",
        "code": payload.code,
        "redirect_uri": payload.redirect_uri,
    }
    if payload.code_verifier:
        form_data["code_verifier"] = payload.code_verifier

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            FITBIT_TOKEN_URL,
            data=form_data,
            headers={"Authorization": f"Basic {credentials}", "Content-Type": "application/x-www-form-urlencoded"},
            timeout=15.0,
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Fitbit token exchange failed. Check the authorization code.")

    tokens = resp.json()
    expiry = datetime.now(timezone.utc) + timedelta(seconds=tokens.get("expires_in", 28800))

    # Fetch Fitbit user profile to get external_user_id
    fitbit_user_id = tokens.get("user_id", "-")

    existing = (
        db.query(WearableConnection)
        .filter(
            WearableConnection.user_id == current_user.id,
            WearableConnection.platform == "fitbit",
        )
        .first()
    )

    if existing:
        existing.is_connected = True
        existing.access_token = tokens["access_token"]
        existing.refresh_token = tokens.get("refresh_token")
        existing.token_expiry = expiry
        existing.external_user_id = fitbit_user_id
        existing.display_name = "Fitbit"
        existing.connected_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing)
        return existing

    conn = WearableConnection(
        user_id=current_user.id,
        platform="fitbit",
        is_connected=True,
        display_name="Fitbit",
        access_token=tokens["access_token"],
        refresh_token=tokens.get("refresh_token"),
        token_expiry=expiry,
        external_user_id=fitbit_user_id,
        connected_at=datetime.now(timezone.utc),
    )
    db.add(conn)
    db.commit()
    db.refresh(conn)
    return conn


@router.post("/fitbit/sync")
async def fitbit_sync(
    sync_date: date | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Pull today's data from Fitbit API and push into health_sync_logs."""
    target_date = sync_date or date.today()
    date_str = target_date.strftime("%Y-%m-%d")

    conn = (
        db.query(WearableConnection)
        .filter(
            WearableConnection.user_id == current_user.id,
            WearableConnection.platform == "fitbit",
            WearableConnection.is_connected == True,  # noqa: E712
        )
        .first()
    )
    if not conn or not conn.access_token:
        raise HTTPException(status_code=400, detail="Fitbit not connected.")

    headers = {"Authorization": f"Bearer {conn.access_token}"}
    async with httpx.AsyncClient() as client:
        activities_resp = await client.get(
            f"{FITBIT_API_BASE}/1/user/-/activities/date/{date_str}.json",
            headers=headers, timeout=15.0,
        )
        hr_resp = await client.get(
            f"{FITBIT_API_BASE}/1/user/-/activities/heart/date/{date_str}/1d.json",
            headers=headers, timeout=15.0,
        )

    if activities_resp.status_code == 401:
        # Token expired — mark disconnected so user can re-auth
        conn.is_connected = False
        db.commit()
        raise HTTPException(status_code=401, detail="Fitbit token expired. Please reconnect Fitbit.")

    summary = activities_resp.json().get("summary", {}) if activities_resp.status_code == 200 else {}
    hr_data = hr_resp.json() if hr_resp.status_code == 200 else {}
    hr_day = (hr_data.get("activities-heart") or [{}])[0].get("value", {})

    steps = summary.get("steps")
    calories = summary.get("caloriesOut")
    distances = summary.get("distances", [])
    total_dist = next((d["distance"] for d in distances if d.get("activity") == "total"), None)
    resting_hr = hr_day.get("restingHeartRate") or summary.get("restingHeartRate")

    # Upsert into health_sync_logs
    from app.models.health_sync import HealthSyncLog
    existing = (
        db.query(HealthSyncLog)
        .filter(HealthSyncLog.user_id == current_user.id, HealthSyncLog.log_date == target_date)
        .first()
    )
    if existing:
        if steps: existing.steps = steps
        if total_dist: existing.distance_km = round(total_dist * 1.60934, 2)
        if calories: existing.active_calories = calories
        if resting_hr: existing.resting_heart_rate_bpm = resting_hr
        existing.source = "fitbit"
        existing.synced_at = datetime.now(timezone.utc)
    else:
        db.add(HealthSyncLog(
            user_id=current_user.id,
            log_date=target_date,
            source="fitbit",
            steps=steps,
            distance_km=round(total_dist * 1.60934, 2) if total_dist else None,
            active_calories=calories,
            resting_heart_rate_bpm=resting_hr,
            synced_at=datetime.now(timezone.utc),
        ))

    conn.last_sync_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "synced_date": date_str,
        "steps": steps,
        "distance_km": round(total_dist * 1.60934, 2) if total_dist else None,
        "active_calories": calories,
        "resting_heart_rate_bpm": resting_hr,
    }


# ── Readiness & Recovery Scores ────────────────────────────────────────────────

def _score_label(score: int) -> str:
    if score >= 85: return "Peak"
    if score >= 70: return "Good"
    if score >= 50: return "Moderate"
    return "Low"


def _compute_readiness(logs: list, workouts: list) -> ReadinessScore:
    today = date.today()
    factors: dict[str, int] = {}
    score = 60  # base

    # Factor 1: Resting HR (uses most recent log with HR data)
    hr_logs = [l for l in logs if l.resting_heart_rate_bpm is not None]
    if hr_logs:
        rhr = hr_logs[0].resting_heart_rate_bpm
        if rhr < 55:
            hr_factor = 20
        elif rhr < 65:
            hr_factor = 12
        elif rhr < 75:
            hr_factor = 5
        elif rhr < 85:
            hr_factor = 0
        else:
            hr_factor = -12
        factors["resting_hr"] = hr_factor
        score += hr_factor

    # Factor 2: Days since last workout
    workout_dates = sorted([w.logged_at.date() for w in workouts], reverse=True)
    days_since: int | None = None
    if workout_dates:
        days_since = (today - workout_dates[0]).days
        if days_since == 0:
            wf = 5
        elif days_since == 1:
            wf = 12
        elif days_since == 2:
            wf = 18
        else:
            wf = 10  # well-rested but potentially undertrained
        factors["recovery_time"] = wf
        score += wf
    else:
        factors["recovery_time"] = 8
        score += 8

    # Factor 3: Average daily steps last 3 days
    recent = [l for l in logs if (today - l.log_date).days <= 3 and l.steps is not None]
    if recent:
        avg_steps = sum(l.steps for l in recent) / len(recent)
        if avg_steps >= 10000:
            sf = 15
        elif avg_steps >= 7500:
            sf = 10
        elif avg_steps >= 5000:
            sf = 5
        else:
            sf = 0
        factors["daily_steps"] = sf
        score += sf

    # Factor 4: Activity consistency (how many of last 7 days have health data)
    tracked_days = len([l for l in logs if (today - l.log_date).days <= 7])
    if tracked_days >= 6:
        cf = 7
    elif tracked_days >= 4:
        cf = 4
    else:
        cf = 0
    factors["consistency"] = cf
    score += cf

    score = max(0, min(100, score))
    label = _score_label(score)

    advice_map = {
        "Peak": "Your body is primed for peak performance. Push hard today.",
        "Good": "You're in good shape. A solid training session will go well.",
        "Moderate": "Consider a moderate intensity session — listen to your body.",
        "Low": "Prioritize recovery today with light activity or rest.",
    }

    return ReadinessScore(score=score, label=label, factors=factors, advice=advice_map[label])


def _compute_recovery(workouts: list, logs: list) -> RecoveryScore:
    today = date.today()

    workout_dates = sorted([w.logged_at.date() for w in workouts], reverse=True)
    days_since: int | None = None
    score = 50

    if not workout_dates:
        return RecoveryScore(
            score=85, label="Good",
            days_since_workout=None, weekly_workout_count=0,
            advice="No recent training load detected. You're fully recovered.",
        )

    days_since = (today - workout_dates[0]).days
    if days_since == 0:
        score += 5
    elif days_since == 1:
        score += 15
    elif days_since == 2:
        score += 30
    else:
        score += 40

    # Weekly workout volume factor
    weekly_count = sum(1 for d in workout_dates if (today - d).days <= 7)
    if weekly_count >= 6:
        score -= 15
    elif weekly_count >= 5:
        score -= 8
    elif weekly_count >= 4:
        score -= 3
    elif weekly_count <= 2:
        score += 10

    # HR recovery: compare today's resting HR vs 7-day average
    hr_logs = [l for l in logs if l.resting_heart_rate_bpm is not None and (today - l.log_date).days <= 7]
    if len(hr_logs) >= 2:
        today_hr = hr_logs[0].resting_heart_rate_bpm if hr_logs[0].log_date == today else None
        avg_hr = sum(l.resting_heart_rate_bpm for l in hr_logs) / len(hr_logs)
        if today_hr is not None:
            if today_hr < avg_hr - 3:
                score += 10
            elif today_hr > avg_hr + 5:
                score -= 10

    score = max(0, min(100, score))
    label = _score_label(score)

    advice_map = {
        "Peak": "Fully recovered. Your body is ready to absorb training stress.",
        "Good": "Well recovered. You can train at full intensity.",
        "Moderate": "Partially recovered. Moderate intensity or technique work is ideal.",
        "Low": "Incomplete recovery. Prioritize sleep, nutrition, and rest today.",
    }

    return RecoveryScore(
        score=score, label=label,
        days_since_workout=days_since,
        weekly_workout_count=weekly_count,
        advice=advice_map[label],
    )


@router.get("/scores", response_model=WearableScoresResponse)
def wearable_scores(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = date.today()
    cutoff = today - timedelta(days=14)

    logs = (
        db.query(HealthSyncLog)
        .filter(HealthSyncLog.user_id == current_user.id, HealthSyncLog.log_date >= cutoff)
        .order_by(HealthSyncLog.log_date.desc())
        .all()
    )
    workouts = (
        db.query(Workout)
        .filter(Workout.user_id == current_user.id, Workout.logged_at >= datetime.combine(cutoff, datetime.min.time()))
        .order_by(Workout.logged_at.desc())
        .all()
    )

    readiness = _compute_readiness(logs, workouts)
    recovery = _compute_recovery(workouts, logs)

    return WearableScoresResponse(
        readiness=readiness,
        recovery=recovery,
        computed_at=datetime.now(timezone.utc),
    )
