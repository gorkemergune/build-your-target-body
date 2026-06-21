/**
 * Platform-aware health service. Metro bundler resolves `./platform` to
 * `./platform.ios.ts` on iOS and `./platform.android.ts` on Android.
 *
 * Usage:
 *   import { requestPermissions, fetchDailySummary } from "@/services/health";
 */
export type { DailyHealthData, HealthPermissionStatus, HealthSource, ImportedWorkout } from "./types";

export {
  SOURCE_NAME,
  SOURCE_KEY,
  isAvailable,
  requestPermissions,
  getPermissionStatus,
  fetchDailySummary,
  fetchWorkouts,
} from "./platform";
