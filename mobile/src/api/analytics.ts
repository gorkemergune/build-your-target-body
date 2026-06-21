import { apiClient } from "./client";
import type { DashboardData, TodaySummary } from "../types";

export async function getDashboard(): Promise<DashboardData> {
  const res = await apiClient.get<DashboardData>("/api/v1/analytics/dashboard");
  return res.data;
}

export async function getTodaySummary(): Promise<TodaySummary> {
  const res = await apiClient.get<TodaySummary>("/api/v1/nutrition/today-summary");
  return res.data;
}

export async function getWeightTrend(days = 30): Promise<{ date: string; value: number }[]> {
  const res = await apiClient.get<{ date: string; value: number }[]>(
    "/api/v1/analytics/weight-trend",
    { params: { days } }
  );
  return res.data;
}

export async function getWorkoutAnalytics() {
  const res = await apiClient.get("/api/v1/analytics/workout-analytics");
  return res.data;
}

export async function getWorkoutIntelligence() {
  const res = await apiClient.get("/api/v1/analytics/workout-intelligence");
  return res.data;
}
