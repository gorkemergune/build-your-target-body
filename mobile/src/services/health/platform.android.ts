import { Platform } from "react-native";
import type { DailyHealthData, HealthPermissionStatus, ImportedWorkout } from "./types";

// Lazy-require for Android builds only
let HC: typeof import("react-native-health-connect") | null = null;
try {
  if (Platform.OS === "android") {
    HC = require("react-native-health-connect");
  }
} catch {
  HC = null;
}

export const SOURCE_NAME = "Health Connect";
export const SOURCE_KEY = "health_connect" as const;

const PERMISSIONS = [
  { accessType: "read", recordType: "Steps" },
  { accessType: "read", recordType: "Distance" },
  { accessType: "read", recordType: "ActiveCaloriesBurned" },
  { accessType: "read", recordType: "ExerciseSession" },
  { accessType: "read", recordType: "HeartRate" },
  { accessType: "read", recordType: "RestingHeartRate" },
];

export async function isAvailable(): Promise<boolean> {
  if (!HC) return false;
  try {
    const status = await HC.getSdkStatus();
    return status === HC.SdkAvailabilityStatus.SDK_AVAILABLE;
  } catch {
    return false;
  }
}

export async function requestPermissions(): Promise<boolean> {
  if (!HC) return false;
  try {
    const available = await isAvailable();
    if (!available) return false;
    await HC.initialize();
    const result = await HC.requestPermission(PERMISSIONS as any);
    return result.every((r: any) => r.granted);
  } catch {
    return false;
  }
}

export async function getPermissionStatus(): Promise<HealthPermissionStatus> {
  if (!HC) return "unavailable";
  try {
    const available = await isAvailable();
    if (!available) return "unavailable";
    const granted = await HC.getGrantedPermissions();
    const hasAll = PERMISSIONS.every((p) =>
      granted.some((g: any) => g.recordType === p.recordType && g.accessType === p.accessType)
    );
    return hasAll ? "authorized" : "notDetermined";
  } catch {
    return "notDetermined";
  }
}

function isoRange(dateStr: string): { startTime: string; endTime: string } {
  const d = new Date(dateStr);
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return { startTime: start.toISOString(), endTime: end.toISOString() };
}

export async function fetchDailySummary(dateStr: string): Promise<DailyHealthData> {
  if (!HC) return { steps: 0, distanceKm: 0, activeCalories: 0, date: dateStr };

  const timeRangeFilter = { operator: "between" as const, ...isoRange(dateStr) };

  try {
    const [stepsRes, distRes, calRes, hrRes, rhrRes] = await Promise.all([
      HC.readRecords("Steps", { timeRangeFilter }),
      HC.readRecords("Distance", { timeRangeFilter }),
      HC.readRecords("ActiveCaloriesBurned", { timeRangeFilter }),
      HC.readRecords("HeartRate", { timeRangeFilter }).catch(() => ({ records: [] })),
      HC.readRecords("RestingHeartRate", { timeRangeFilter }).catch(() => ({ records: [] })),
    ]);

    const steps = (stepsRes.records as any[]).reduce((s, r) => s + (r.count ?? 0), 0);
    const distanceM = (distRes.records as any[]).reduce((s, r) => s + (r.distance?.inMeters ?? 0), 0);
    const calories = (calRes.records as any[]).reduce((s, r) => s + (r.energy?.inKilocalories ?? 0), 0);

    const hrSamples: number[] = (hrRes.records as any[]).flatMap((r: any) =>
      (r.samples ?? []).map((s: any) => s.beatsPerMinute ?? 0).filter(Boolean)
    );
    const avgHr = hrSamples.length ? Math.round(hrSamples.reduce((a, b) => a + b, 0) / hrSamples.length) : null;
    const maxHr = hrSamples.length ? Math.round(Math.max(...hrSamples)) : null;
    const rhrRecords = (rhrRes.records as any[]);
    const restingHr = rhrRecords.length ? Math.round(rhrRecords[rhrRecords.length - 1]?.beatsPerMinute ?? 0) || null : null;

    return {
      steps: Math.round(steps),
      distanceKm: Math.round((distanceM / 1000) * 100) / 100,
      activeCalories: Math.round(calories),
      date: dateStr,
      restingHeartRateBpm: restingHr,
      avgHeartRateBpm: avgHr,
      maxHeartRateBpm: maxHr,
    };
  } catch {
    return { steps: 0, distanceKm: 0, activeCalories: 0, date: dateStr };
  }
}

// Health Connect exercise type → our workout type
const EXERCISE_TYPE_MAP: Record<number, string> = {
  2: "running",       // BIKING → cycling
  4: "running",       // CALISTHENICS → cardio
  7: "cycling",       // CYCLING
  56: "running",      // RUNNING
  79: "strength",     // STRENGTH_TRAINING
  80: "running",      // SWIMMING
  82: "running",      // WALKING
  45: "pilates",      // PILATES
  5: "crossfit",      // CROSS_FIT
};

export async function fetchWorkouts(startDateStr: string, endDateStr: string): Promise<ImportedWorkout[]> {
  if (!HC) return [];
  try {
    const start = new Date(startDateStr);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDateStr);
    end.setHours(23, 59, 59, 999);

    const res = await HC.readRecords("ExerciseSession", {
      timeRangeFilter: {
        operator: "between",
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      },
    });

    return (res.records as any[]).map((r: any) => {
      const startMs = new Date(r.startTime).getTime();
      const endMs = new Date(r.endTime).getTime();
      const durationMin = Math.round((endMs - startMs) / 60000);
      const wtype = EXERCISE_TYPE_MAP[r.exerciseType] ?? "cardio";

      return {
        name: r.title ?? wtype.charAt(0).toUpperCase() + wtype.slice(1),
        workoutType: wtype,
        durationMinutes: durationMin > 0 ? durationMin : null,
        activeCalories: null,
        distanceKm: null,
        startDate: r.startTime,
        source: SOURCE_KEY,
      };
    });
  } catch {
    return [];
  }
}
