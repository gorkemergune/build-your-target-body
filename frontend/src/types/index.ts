export interface WeightLog {
  id: number;
  weight_kg: number;
  logged_at: string;
  notes: string | null;
}

export interface BodyFatLog {
  id: number;
  body_fat_pct: number;
  logged_at: string;
  notes: string | null;
}

export interface MeasurementLog {
  id: number;
  logged_at: string;
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  neck_cm: number | null;
  left_arm_cm: number | null;
  right_arm_cm: number | null;
  left_thigh_cm: number | null;
  right_thigh_cm: number | null;
}

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
  daily_notes: string | null;
  food_entries: FoodEntry[];
}

export interface WorkoutExercise {
  id: number;
  exercise_name: string;
  sets: number | null;
  reps: number | null;
  weight_kg: number | null;
  duration_seconds: number | null;
  notes: string | null;
}

export interface Workout {
  id: number;
  name: string;
  logged_at: string;
  duration_minutes: number | null;
  notes: string | null;
  exercises: WorkoutExercise[];
}

export interface WorkoutAnalytics {
  workouts_this_week: number;
  workouts_this_month: number;
  total_workouts: number;
  total_volume_kg: number;
  avg_duration_minutes: number | null;
}

export interface GoalProgress {
  has_goal: boolean;
  has_data?: boolean;
  goal_type?: string;
  start_weight_kg?: number;
  target_weight_kg?: number | null;
  target_body_fat_pct?: number | null;
  target_date?: string | null;
  latest_weight_kg?: number;
  total_change_kg?: number;
  progress_pct?: number | null;
  days_remaining?: number | null;
  avg_weekly_change_kg?: number | null;
  estimated_completion_date?: string | null;
  log_count?: number;
  first_log_date?: string;
  latest_log_date?: string;
}

export interface TrendPoint {
  date: string;
  value: number | null;
}

export interface IntelligenceForecast {
  progress_pct: number | null;
  eta_date: string | null;
  days_ahead: number | null;
  required_weekly_change_kg: number | null;
  weekly_change_kg: number | null;
  monthly_change_kg: number | null;
  monthly_fat_change_pct: number | null;
}

export interface IntelligenceHealthScore {
  total: number;
  weight_consistency: number;
  nutrition_consistency: number;
  workout_consistency: number;
  goal_progress: number;
}

export interface IntelligencePlateau {
  detected: boolean;
  severity: "major" | "minor" | null;
  days_checked: number | null;
  weight_range_kg: number | null;
}

export interface Intelligence {
  forecast: IntelligenceForecast;
  health_score: IntelligenceHealthScore;
  plateau: IntelligencePlateau;
  trends: {
    weekly_weight_change_kg: number | null;
    monthly_weight_change_kg: number | null;
    monthly_fat_change_pct: number | null;
  };
  insights: string[];
}

export interface ProjectionPoint {
  date: string;
  actual_weight: number | null;
  projected_weight: number | null;
  target_weight: number | null;
}
