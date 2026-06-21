import { apiClient } from "./client";
import type { WeightLog, NutritionLog, FoodEntry, Workout, WorkoutType } from "../types";

// ── Weight ────────────────────────────────────────────────────────────────────

export async function getWeightLogs(limit = 30): Promise<WeightLog[]> {
  const res = await apiClient.get<WeightLog[]>("/api/v1/weight", { params: { limit } });
  return res.data;
}

export async function logWeight(weight_kg: number, logged_at: string, notes?: string): Promise<WeightLog> {
  const res = await apiClient.post<WeightLog>("/api/v1/weight", { weight_kg, logged_at, notes });
  return res.data;
}

export async function deleteWeight(id: number): Promise<void> {
  await apiClient.delete(`/api/v1/weight/${id}`);
}

// ── Nutrition ─────────────────────────────────────────────────────────────────

export async function getNutritionLogs(limit = 30): Promise<NutritionLog[]> {
  const res = await apiClient.get<NutritionLog[]>("/api/v1/nutrition", { params: { limit } });
  return res.data;
}

export async function getNutritionLog(date: string): Promise<NutritionLog> {
  const res = await apiClient.get<NutritionLog>(`/api/v1/nutrition/${date}`);
  return res.data;
}

export async function createNutritionLog(logged_date: string): Promise<NutritionLog> {
  const res = await apiClient.post<NutritionLog>("/api/v1/nutrition", { logged_date });
  return res.data;
}

export async function addFoodEntry(
  logId: number,
  entry: { meal_type: string; food_name: string; calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number; quantity_g?: number }
): Promise<FoodEntry> {
  const res = await apiClient.post<FoodEntry>(`/api/v1/nutrition/${logId}/foods`, entry);
  return res.data;
}

export async function deleteFoodEntry(logId: number, entryId: number): Promise<void> {
  await apiClient.delete(`/api/v1/nutrition/${logId}/foods/${entryId}`);
}

// ── Workout ───────────────────────────────────────────────────────────────────

export async function getWorkouts(limit = 20): Promise<Workout[]> {
  const res = await apiClient.get<Workout[]>("/api/v1/workouts", { params: { limit } });
  return res.data;
}

export interface CreateWorkoutPayload {
  name: string;
  workout_type: WorkoutType;
  logged_at: string;
  duration_minutes?: number;
  notes?: string;
  exercises?: {
    exercise_name: string;
    exercise_id?: number | null;
    order_index: number;
    sets_data: {
      set_number: number;
      set_type: "warmup" | "working";
      reps?: number;
      weight_kg?: number;
      rpe?: number;
    }[];
  }[];
}

export async function createWorkout(payload: CreateWorkoutPayload): Promise<Workout> {
  const res = await apiClient.post<Workout>("/api/v1/workouts", payload);
  return res.data;
}

export async function deleteWorkout(id: number): Promise<void> {
  await apiClient.delete(`/api/v1/workouts/${id}`);
}
