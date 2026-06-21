export type HealthPermissionStatus = "authorized" | "denied" | "notDetermined" | "unavailable";

export type HealthSource = "apple_health" | "health_connect";

export interface DailyHealthData {
  steps: number;
  distanceKm: number;
  activeCalories: number;
  date: string; // YYYY-MM-DD
  restingHeartRateBpm?: number | null;
  avgHeartRateBpm?: number | null;
  maxHeartRateBpm?: number | null;
}

export interface ImportedWorkout {
  name: string;
  workoutType: string;
  durationMinutes: number | null;
  activeCalories: number | null;
  distanceKm: number | null;
  startDate: string;
  source: HealthSource;
}
