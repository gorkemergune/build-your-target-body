import { apiClient } from "./client";
import type { HealthSource } from "../services/health/types";

export interface HealthSyncPayload {
  log_date: string; // YYYY-MM-DD
  source: HealthSource;
  steps?: number | null;
  distance_km?: number | null;
  active_calories?: number | null;
  resting_heart_rate_bpm?: number | null;
  avg_heart_rate_bpm?: number | null;
  max_heart_rate_bpm?: number | null;
}

export interface HealthSyncRecord {
  id: number;
  log_date: string;
  source: string;
  steps: number | null;
  distance_km: number | null;
  active_calories: number | null;
  resting_heart_rate_bpm: number | null;
  avg_heart_rate_bpm: number | null;
  max_heart_rate_bpm: number | null;
  synced_at: string;
}

export interface HealthSummary {
  today: HealthSyncRecord | null;
  last_sync_at: string | null;
  source: string | null;
  history: HealthSyncRecord[];
}

export interface ImportWorkoutPayload {
  name: string;
  workout_type: string;
  logged_at: string;
  duration_minutes?: number | null;
  active_calories?: number | null;
  distance_km?: number | null;
  source: HealthSource;
}

export async function pushHealthSync(payload: HealthSyncPayload): Promise<HealthSyncRecord> {
  const res = await apiClient.post<HealthSyncRecord>("/api/v1/health/sync", payload);
  return res.data;
}

export async function getHealthSummary(days = 7): Promise<HealthSummary> {
  const res = await apiClient.get<HealthSummary>("/api/v1/health/summary", { params: { days } });
  return res.data;
}

export async function getHealthHistory(days = 30): Promise<HealthSyncRecord[]> {
  const res = await apiClient.get<HealthSyncRecord[]>("/api/v1/health/history", { params: { days } });
  return res.data;
}

export async function importWorkout(payload: ImportWorkoutPayload): Promise<{ id: number; name: string; imported: boolean }> {
  const res = await apiClient.post("/api/v1/health/import-workout", payload);
  return res.data;
}
