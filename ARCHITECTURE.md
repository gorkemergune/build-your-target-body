# Architecture Document

## System Overview

Build Your Target Body is a full-stack body transformation platform.

```
┌─────────────────────────────────────────────────────┐
│                    Client (Browser)                  │
│              Next.js 14 + TypeScript                 │
│         Tailwind CSS + shadcn/ui + next-intl         │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS / REST
┌──────────────────────▼──────────────────────────────┐
│                 FastAPI Backend                       │
│           Python 3.11+ / Uvicorn                     │
│  ┌───────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  API v1   │  │  Services    │  │  AI Layer    │  │
│  │ (routes)  │  │ (biz logic)  │  │  (Gemini)    │  │
│  └─────┬─────┘  └──────┬───────┘  └──────┬───────┘  │
│        └───────────────▼──────────────────┘          │
│                  SQLAlchemy ORM                       │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│               PostgreSQL 16                          │
└─────────────────────────────────────────────────────┘
```

## Directory Structure

```
build-your-target-body/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/     # Route handlers
│   │   ├── core/                 # Config, security, dependencies
│   │   ├── db/                   # Session, base model
│   │   ├── models/               # SQLAlchemy models
│   │   ├── schemas/              # Pydantic schemas
│   │   ├── services/             # Business logic
│   │   └── utils/                # Helpers
│   ├── alembic/                  # DB migrations
│   ├── tests/
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/                  # Next.js App Router
│   │   ├── components/           # Shared UI components
│   │   ├── lib/                  # API client, utils
│   │   ├── hooks/                # Custom React hooks
│   │   ├── stores/               # Zustand state
│   │   └── types/                # TypeScript types
│   ├── messages/                 # i18n translation files
│   │   ├── en.json
│   │   └── tr.json
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── .env.example
```

## ER Diagram

```
users
├── id (PK)
├── email (unique)
├── hashed_password
├── full_name
├── gender
├── birth_date
├── height_cm
├── activity_level
├── preferred_language
├── created_at
└── updated_at

goals
├── id (PK)
├── user_id (FK → users)
├── goal_type         [weight_loss|weight_gain|recomp|muscle_gain]
├── start_weight_kg
├── target_weight_kg
├── start_body_fat_pct
├── target_body_fat_pct
├── target_date
├── is_active
├── created_at
└── updated_at

weight_logs
├── id (PK)
├── user_id (FK → users)
├── logged_at
├── weight_kg
└── notes

body_fat_logs
├── id (PK)
├── user_id (FK → users)
├── logged_at
├── body_fat_pct
└── notes

measurement_logs
├── id (PK)
├── user_id (FK → users)
├── logged_at
├── chest_cm
├── waist_cm
├── hips_cm
├── neck_cm
├── left_arm_cm
├── right_arm_cm
├── left_thigh_cm
└── right_thigh_cm

nutrition_logs
├── id (PK)
├── user_id (FK → users)
├── logged_date
├── total_calories
├── protein_g
├── carbs_g
├── fat_g
└── water_ml

food_entries
├── id (PK)
├── nutrition_log_id (FK → nutrition_logs)
├── meal_type         [breakfast|lunch|dinner|snack]
├── food_name
├── quantity_g
├── calories
├── protein_g
├── carbs_g
└── fat_g

workouts
├── id (PK)
├── user_id (FK → users)
├── logged_at
├── name
├── notes
└── duration_minutes

workout_exercises
├── id (PK)
├── workout_id (FK → workouts)
├── exercise_name
├── sets
├── reps
├── weight_kg
├── duration_seconds
└── notes

ai_conversations
├── id (PK)
├── user_id (FK → users)
├── conversation_type  [nutrition|workout|goal_analysis|progress]
├── prompt
├── response
└── created_at
```

## API Structure

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh

GET    /api/v1/users/me
PUT    /api/v1/users/me

POST   /api/v1/goals/
GET    /api/v1/goals/active
GET    /api/v1/goals/{id}

POST   /api/v1/weight/
GET    /api/v1/weight/
GET    /api/v1/weight/summary

POST   /api/v1/body-fat/
GET    /api/v1/body-fat/

POST   /api/v1/measurements/
GET    /api/v1/measurements/

POST   /api/v1/nutrition/
GET    /api/v1/nutrition/{date}
POST   /api/v1/nutrition/{log_id}/foods

POST   /api/v1/workouts/
GET    /api/v1/workouts/
GET    /api/v1/workouts/{id}

GET    /api/v1/analytics/dashboard
GET    /api/v1/analytics/weight-trend
GET    /api/v1/analytics/fat-trend
GET    /api/v1/analytics/calorie-trend

POST   /api/v1/ai/coach
GET    /api/v1/ai/conversations
```
