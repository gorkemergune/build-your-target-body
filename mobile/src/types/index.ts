// ── Auth ──────────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  email: string;
  full_name: string;
  gender: string | null;
  birth_date: string | null;
  height_cm: number | null;
  activity_level: string | null;
  preferred_language: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

// ── Weight ────────────────────────────────────────────────────────────────────

export interface WeightLog {
  id: number;
  weight_kg: number;
  logged_at: string;
  notes: string | null;
}

// ── Nutrition ─────────────────────────────────────────────────────────────────

export interface FoodEntry {
  id: number;
  meal_type: string;
  food_name: string;
  quantity_g: number | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
}

export interface NutritionLog {
  id: number;
  logged_date: string;
  total_calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  water_ml: number | null;
  food_entries: FoodEntry[];
}

export interface TodaySummary {
  calories_consumed: number | null;
  calories_target: number | null;
  protein_g: number | null;
  protein_target_g: number | null;
  carbs_g: number | null;
  carbs_target_g: number | null;
  fat_g: number | null;
  fat_target_g: number | null;
  calories_remaining: number | null;
}

// ── Workout ───────────────────────────────────────────────────────────────────

export type WorkoutType = "strength" | "cardio" | "running" | "cycling" | "pilates" | "crossfit";
export type SetType = "warmup" | "working";

export interface WorkoutSet {
  id: number;
  set_number: number;
  set_type: SetType;
  reps: number | null;
  weight_kg: number | null;
  rpe: number | null;
  duration_seconds: number | null;
  distance_km: number | null;
}

export interface WorkoutExercise {
  id: number;
  exercise_name: string;
  exercise_id: number | null;
  order_index: number;
  workout_sets: WorkoutSet[];
}

export interface Workout {
  id: number;
  name: string;
  logged_at: string;
  workout_type: WorkoutType;
  duration_minutes: number | null;
  notes: string | null;
  total_volume_kg: number | null;
  total_sets: number | null;
  total_reps: number | null;
  exercises: WorkoutExercise[];
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface DashboardData {
  latest_weight_kg: number | null;
  latest_body_fat_pct: number | null;
  active_goal: {
    goal_type: string;
    target_weight_kg: number | null;
    target_date: string | null;
    days_remaining: number | null;
    progress_pct: number | null;
  } | null;
  todays_calories: number | null;
  todays_protein_g: number | null;
  workouts_this_week: number;
  consistency_score: number;
  recent_workouts: { id: number; name: string; logged_at: string; duration_minutes: number | null }[];
}

// ── AI ────────────────────────────────────────────────────────────────────────

export interface AiMessage {
  id: number;
  prompt: string;
  response: string;
  created_at: string;
}

// ── Progress Photo ────────────────────────────────────────────────────────────

export interface ProgressPhoto {
  id: number;
  image_url: string;
  uploaded_at: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  note: string | null;
}
