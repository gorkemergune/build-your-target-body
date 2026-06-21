import { Platform } from "react-native";
import type { DailyHealthData, HealthPermissionStatus, ImportedWorkout } from "./types";

// Lazy-require so the module is only resolved on iOS builds
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AppleHealthKit = Platform.OS === "ios" ? require("react-native-health").default : null;

const PERMISSIONS = AppleHealthKit
  ? {
      permissions: {
        read: [
          AppleHealthKit.Constants.Permissions.Steps,
          AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
          AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
          AppleHealthKit.Constants.Permissions.Workout,
          AppleHealthKit.Constants.Permissions.RestingHeartRate,
          AppleHealthKit.Constants.Permissions.HeartRate,
        ],
        write: [],
      },
    }
  : null;

export const SOURCE_NAME = "Apple Health";
export const SOURCE_KEY = "apple_health" as const;

let _initialized = false;

export async function isAvailable(): Promise<boolean> {
  if (!AppleHealthKit) return false;
  try {
    return await new Promise((resolve) => {
      AppleHealthKit.isAvailable((err: any, available: boolean) => {
        resolve(!err && available);
      });
    });
  } catch {
    return false;
  }
}

export async function requestPermissions(): Promise<boolean> {
  if (!AppleHealthKit || !PERMISSIONS) return false;
  return new Promise((resolve) => {
    AppleHealthKit.initHealthKit(PERMISSIONS, (err: any) => {
      _initialized = !err;
      resolve(!err);
    });
  });
}

export async function getPermissionStatus(): Promise<HealthPermissionStatus> {
  if (!AppleHealthKit) return "unavailable";
  if (_initialized) return "authorized";
  // HealthKit doesn't expose a "check without requesting" API;
  // attempt init silently to detect prior authorization
  const ok = await requestPermissions();
  return ok ? "authorized" : "notDetermined";
}

function startOfDay(dateStr: string): string {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfDay(dateStr: string): string {
  const d = new Date(dateStr);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export async function fetchDailySummary(dateStr: string): Promise<DailyHealthData> {
  if (!AppleHealthKit) {
    return { steps: 0, distanceKm: 0, activeCalories: 0, date: dateStr };
  }

  const startDate = startOfDay(dateStr);
  const endDate = endOfDay(dateStr);
  const opts = { startDate, endDate };

  const [steps, distanceMiles, calories, restingHr, hrSamples] = await Promise.all([
    new Promise<number>((resolve) => {
      AppleHealthKit.getStepCount({ date: new Date(dateStr).toISOString() }, (err: any, res: any) => {
        resolve(err ? 0 : (res?.value ?? 0));
      });
    }),
    new Promise<number>((resolve) => {
      AppleHealthKit.getDistanceWalkingRunning(opts, (err: any, results: any[]) => {
        if (err || !results?.length) return resolve(0);
        const total = results.reduce((s: number, r: any) => s + (r?.value ?? 0), 0);
        resolve(total);
      });
    }),
    new Promise<number>((resolve) => {
      AppleHealthKit.getActiveEnergyBurned(opts, (err: any, results: any[]) => {
        if (err || !results?.length) return resolve(0);
        const total = results.reduce((s: number, r: any) => s + (r?.value ?? 0), 0);
        resolve(total);
      });
    }),
    new Promise<number | null>((resolve) => {
      AppleHealthKit.getRestingHeartRate({ date: new Date(dateStr).toISOString() }, (err: any, res: any) => {
        resolve(err ? null : (res?.value ?? null));
      });
    }),
    new Promise<number[]>((resolve) => {
      AppleHealthKit.getHeartRateSamples(opts, (err: any, results: any[]) => {
        if (err || !results?.length) return resolve([]);
        resolve(results.map((r: any) => r?.value ?? 0).filter(Boolean));
      });
    }),
  ]);

  // HealthKit returns distance in miles by default
  const distanceKm = distanceMiles * 1.60934;
  const avgHr = hrSamples.length ? Math.round(hrSamples.reduce((a, b) => a + b, 0) / hrSamples.length) : null;
  const maxHr = hrSamples.length ? Math.round(Math.max(...hrSamples)) : null;

  return {
    steps: Math.round(steps),
    distanceKm: Math.round(distanceKm * 100) / 100,
    activeCalories: Math.round(calories),
    date: dateStr,
    restingHeartRateBpm: restingHr ? Math.round(restingHr) : null,
    avgHeartRateBpm: avgHr,
    maxHeartRateBpm: maxHr,
  };
}

// HealthKit workout type → our workout type
const WORKOUT_TYPE_MAP: Record<number, string> = {
  1: "running",
  2: "cycling",
  13: "running",  // walking → running category
  20: "strength",
  52: "pilates",
  3: "crossfit",
};

export async function fetchWorkouts(startDateStr: string, endDateStr: string): Promise<ImportedWorkout[]> {
  if (!AppleHealthKit) return [];
  return new Promise((resolve) => {
    AppleHealthKit.getSamples(
      {
        startDate: new Date(startDateStr).toISOString(),
        endDate: new Date(endDateStr).toISOString(),
        type: "Workout",
      },
      (err: any, results: any[]) => {
        if (err || !results) return resolve([]);
        const workouts: ImportedWorkout[] = results.map((w: any) => {
          const durationMin = Math.round((w.duration ?? 0) / 60);
          const wtype = WORKOUT_TYPE_MAP[w.workoutActivityType] ?? "cardio";
          return {
            name: w.activityName ?? "Workout",
            workoutType: wtype,
            durationMinutes: durationMin > 0 ? durationMin : null,
            activeCalories: w.calories ? Math.round(w.calories) : null,
            distanceKm: w.distance ? Math.round(w.distance * 1.60934 * 100) / 100 : null,
            startDate: w.startDate ?? startDateStr,
            source: SOURCE_KEY,
          };
        });
        resolve(workouts);
      }
    );
  });
}
