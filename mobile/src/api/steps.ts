import { apiClient } from "./client";

export interface DailyStepRecord {
  date: string;
  steps: number;
  source: string;
}

export interface StepAnalytics {
  today_steps: number | null;
  today_goal: number;
  today_pct: number;
  remaining_today: number | null;
  this_week_total: number;
  this_week_avg_daily: number;
  active_days_this_week: number;
  last_week_total: number;
  week_over_week_pct: number | null;
  this_month_total: number;
  daily_history: DailyStepRecord[];
  best_day: DailyStepRecord | null;
}

export interface StepAchievement {
  key: string;
  title: string;
  description: string;
  icon: string;
  unlocked_at: string;
  notes: string | null;
}

export interface StepCoaching {
  recommendation: string;
  warning: string | null;
  movement_goal: string;
  coaching_source: string;
}

export async function getStepAnalytics(goal = 10000): Promise<StepAnalytics> {
  const res = await apiClient.get<StepAnalytics>("/api/v1/steps/analytics", { params: { goal } });
  return res.data;
}

export async function getStepAchievements(): Promise<StepAchievement[]> {
  const res = await apiClient.get<StepAchievement[]>("/api/v1/steps/achievements");
  return res.data;
}

export async function checkStepAchievements(goal = 10000): Promise<StepAchievement[]> {
  const res = await apiClient.post<StepAchievement[]>("/api/v1/steps/check-achievements", null, { params: { goal } });
  return res.data;
}

export async function getStepCoaching(language = "en", goal = 10000): Promise<StepCoaching> {
  const res = await apiClient.get<StepCoaching>("/api/v1/steps/coaching", { params: { language, goal } });
  return res.data;
}
