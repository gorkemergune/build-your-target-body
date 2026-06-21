import { apiClient } from "./client";

export type WearablePlatform = "apple_watch" | "garmin" | "fitbit";

export interface WearableConnection {
  id: number;
  platform: WearablePlatform;
  is_connected: boolean;
  display_name: string | null;
  last_sync_at: string | null;
  connected_at: string;
}

export interface ReadinessScore {
  score: number;
  label: "Peak" | "Good" | "Moderate" | "Low";
  factors: Record<string, number>;
  advice: string;
}

export interface RecoveryScore {
  score: number;
  label: "Peak" | "Good" | "Moderate" | "Low";
  days_since_workout: number | null;
  weekly_workout_count: number;
  advice: string;
}

export interface WearableScores {
  readiness: ReadinessScore;
  recovery: RecoveryScore;
  computed_at: string;
}

export async function getConnections(): Promise<WearableConnection[]> {
  const res = await apiClient.get<WearableConnection[]>("/api/v1/wearable/connections");
  return res.data;
}

export async function connectWearable(platform: WearablePlatform, displayName?: string): Promise<WearableConnection> {
  const res = await apiClient.post<WearableConnection>("/api/v1/wearable/connect", {
    platform,
    display_name: displayName,
  });
  return res.data;
}

export async function disconnectWearable(platform: WearablePlatform): Promise<void> {
  await apiClient.delete(`/api/v1/wearable/connect/${platform}`);
}

export async function getFitbitAuthUrl(redirectUri: string): Promise<{ auth_url: string; state: string }> {
  const res = await apiClient.get<{ auth_url: string; state: string }>("/api/v1/wearable/fitbit/auth-url", {
    params: { redirect_uri: redirectUri },
  });
  return res.data;
}

export async function exchangeFitbitCode(
  code: string,
  redirectUri: string,
  codeVerifier?: string
): Promise<WearableConnection> {
  const res = await apiClient.post<WearableConnection>("/api/v1/wearable/fitbit/exchange", {
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });
  return res.data;
}

export async function syncFitbit(syncDate?: string): Promise<Record<string, unknown>> {
  const res = await apiClient.post("/api/v1/wearable/fitbit/sync", null, {
    params: syncDate ? { sync_date: syncDate } : undefined,
  });
  return res.data;
}

export async function getWearableScores(): Promise<WearableScores> {
  const res = await apiClient.get<WearableScores>("/api/v1/wearable/scores");
  return res.data;
}
