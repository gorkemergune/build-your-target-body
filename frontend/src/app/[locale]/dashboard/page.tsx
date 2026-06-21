"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TrendChart } from "@/components/charts/TrendChart";
import { ProjectionChart } from "@/components/charts/ProjectionChart";
import { api } from "@/lib/api";
import { formatNumber, formatChange, formatDate } from "@/lib/utils";
import type { GoalProgress, Intelligence, ProjectionPoint } from "@/types";

interface LatestReport {
  id: number;
  type: string;
  title: string;
  generated_at: string;
}

interface LatestPhoto {
  id: number;
  uploaded_at: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  note: string | null;
}
import {
  Scale,
  Percent,
  Calendar,
  Flame,
  Target,
  Dumbbell,
  Ruler,
  Beef,
  Trophy,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  Clock,
  Activity,
  Heart,
  Bot,
  FileText,
  Camera,
  Zap,
  Info,
  Brain,
} from "lucide-react";
import Link from "next/link";
import { QuickActionsCard } from "@/components/dashboard/QuickActionsCard";
import { CoachFeedCard } from "@/components/dashboard/CoachFeedCard";
import { DailyMissionsCard } from "@/components/dashboard/DailyMissionsCard";
import { StepIntelligenceCard } from "@/components/dashboard/StepIntelligenceCard";
import { AchievementToast } from "@/components/achievements/AchievementToast";

interface DashboardData {
  latest_weight_kg: number | null;
  latest_body_fat_pct: number | null;
  active_goal: {
    goal_type: string;
    target_weight_kg: number | null;
    target_date: string | null;
    days_remaining: number | null;
    progress_pct: number | null;
  } | null;
  todays_calories: number | null;
  todays_protein_g: number | null;
  workouts_this_week: number;
  consistency_score: number;
  recent_workouts: { id: number; name: string; logged_at: string; duration_minutes: number | null }[];
  latest_measurement: {
    chest_cm: number | null;
    waist_cm: number | null;
    hips_cm: number | null;
    left_arm_cm: number | null;
  } | null;
}

const INSIGHT_COLORS: Record<string, string> = {
  insight_no_data: "bg-muted text-muted-foreground",
  insight_plateau_detected: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  insight_goal_reached: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  insight_close_to_goal: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  insight_ahead_schedule: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  insight_behind_schedule: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  insight_on_track: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  insight_excellent_consistency: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  insight_good_consistency: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  insight_poor_consistency: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
};

function TrendIcon({ value }: { value: number | null }) {
  if (value == null) return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  if (value > 0.1) return <TrendingUp className="h-3.5 w-3.5 text-red-500" />;
  if (value < -0.1) return <TrendingDown className="h-3.5 w-3.5 text-green-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

export default function DashboardPage({ params: { locale } }: { params: { locale: string } }) {
  const t = useTranslations("dashboard");
  const [data, setData] = useState<DashboardData | null>(null);
  const [progress, setProgress] = useState<GoalProgress | null>(null);
  const [intel, setIntel] = useState<Intelligence | null>(null);
  const [projection, setProjection] = useState<ProjectionPoint[]>([]);
  const [weightTrend, setWeightTrend] = useState<{ date: string; value: number }[]>([]);
  const [fatTrend, setFatTrend] = useState<{ date: string; value: number }[]>([]);
  const [latestReport, setLatestReport] = useState<LatestReport | null>(null);
  const [latestPhoto, setLatestPhoto] = useState<LatestPhoto | null>(null);
  const [streak, setStreak] = useState<{ current_streak: number; longest_streak: number; last_activity_date: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [todaySummary, setTodaySummary] = useState<any>(null);
  const [workoutIntel, setWorkoutIntel] = useState<any>(null);

  useEffect(() => {
    api.get("/api/v1/nutrition/today-summary").then((r) => setTodaySummary(r.data)).catch(() => {});
    api.get("/api/v1/analytics/workout-intelligence").then((r) => setWorkoutIntel(r.data)).catch(() => {});

    api.get("/api/v1/reports?limit=1").then((r) => {
      if (r.data.length > 0) setLatestReport(r.data[0]);
    }).catch(() => {});

    api.get("/api/v1/photos").then((r) => {
      if (r.data.length > 0) setLatestPhoto(r.data[0]);
    }).catch(() => {});

    api.get("/api/v1/analytics/streak").then((r) => setStreak(r.data)).catch(() => {});

    Promise.allSettled([
      api.get("/api/v1/analytics/dashboard"),
      api.get("/api/v1/analytics/goal-progress"),
      api.get("/api/v1/analytics/intelligence"),
      api.get("/api/v1/analytics/projection"),
      api.get("/api/v1/analytics/weight-trend?days=30"),
      api.get("/api/v1/analytics/fat-trend?days=30"),
    ])
      .then(([dash, prog, int_, proj, wt, ft]) => {
        if (dash.status === "fulfilled") setData(dash.value.data);
        if (prog.status === "fulfilled") setProgress(prog.value.data);
        if (int_.status === "fulfilled") setIntel(int_.value.data);
        if (proj.status === "fulfilled") setProjection(proj.value.data);
        if (wt.status === "fulfilled") setWeightTrend(wt.value.data);
        if (ft.status === "fulfilled") setFatTrend(ft.value.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <AppLayout locale={locale}>
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          {t("title")}...
        </div>
      </AppLayout>
    );
  }

  const goalTypeLabel = progress?.goal_type
    ? progress.goal_type.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : null;

  const hs = intel?.health_score;
  const forecast = intel?.forecast;
  const plateau = intel?.plateau;

  return (
    <AppLayout locale={locale}>
      <AchievementToast locale={locale} />
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{t("title")}</h1>

        {/* ── Quick Actions ── */}
        <QuickActionsCard locale={locale} />

        {/* ── Daily Missions ── */}
        <DailyMissionsCard locale={locale} />

        {/* ── Stat Cards Row 1 ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<Scale className="h-5 w-5 text-blue-500" />}
            label={t("currentWeight")}
            value={data?.latest_weight_kg != null ? `${formatNumber(data.latest_weight_kg)} kg` : "—"}
          />
          <StatCard
            icon={<Percent className="h-5 w-5 text-orange-500" />}
            label={t("bodyFat")}
            value={data?.latest_body_fat_pct != null ? `${formatNumber(data.latest_body_fat_pct)} %` : "—"}
          />
          <StatCard
            icon={<Flame className="h-5 w-5 text-red-500" />}
            label={t("todayCalories")}
            value={data?.todays_calories ? `${Math.round(data.todays_calories)} kcal` : "—"}
          />
          <StatCard
            icon={<Beef className="h-5 w-5 text-green-500" />}
            label={t("todayProtein")}
            value={data?.todays_protein_g != null ? `${formatNumber(data.todays_protein_g)} g` : "—"}
          />
        </div>

        {/* ── Stat Cards Row 2 ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<Calendar className="h-5 w-5 text-purple-500" />}
            label={t("daysRemaining")}
            value={progress?.days_remaining != null ? String(progress.days_remaining) : "—"}
          />
          <StatCard
            icon={<Dumbbell className="h-5 w-5 text-violet-500" />}
            label={t("weeklyWorkouts")}
            value={data?.workouts_this_week != null ? String(data.workouts_this_week) : "—"}
          />
          <StatCard
            icon={<Trophy className="h-5 w-5 text-yellow-500" />}
            label={t("consistencyScore")}
            value={data?.consistency_score != null ? `${data.consistency_score}%` : "—"}
          />
          <StatCard
            icon={<Target className="h-5 w-5 text-rose-500" />}
            label={t("goalProgress")}
            value={progress?.progress_pct != null ? `${formatNumber(progress.progress_pct, 0)}%` : "—"}
          />
        </div>

        {/* ── Macro Remaining Card ── */}
        {todaySummary?.targets_available && todaySummary?.remaining && todaySummary?.consumed && todaySummary?.targets && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Flame className="h-4 w-4 text-primary" />
                {t("macroRemaining")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Calories */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{t("calories")}</span>
                    <span className={`font-semibold ${todaySummary.remaining.calories <= 0 ? "text-green-600" : ""}`}>
                      {todaySummary.remaining.calories > 0 ? `${todaySummary.remaining.calories}` : "✓"}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${todaySummary.consumed.calories > todaySummary.targets.max_calories ? "bg-red-500" : todaySummary.remaining.calories <= 0 ? "bg-green-500" : "bg-primary"}`}
                      style={{ width: `${Math.min(100, todaySummary.targets.calories > 0 ? (todaySummary.consumed.calories / todaySummary.targets.calories) * 100 : 0)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{todaySummary.consumed.calories} / {todaySummary.targets.calories} kcal</p>
                </div>
                {/* Protein */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{t("protein")}</span>
                    <span className={`font-semibold ${todaySummary.remaining.protein_g <= 0 ? "text-green-600" : ""}`}>
                      {todaySummary.remaining.protein_g > 0 ? `${todaySummary.remaining.protein_g}g` : "✓"}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${todaySummary.remaining.protein_g <= 0 ? "bg-green-500" : "bg-blue-500"}`}
                      style={{ width: `${Math.min(100, todaySummary.targets.protein_g > 0 ? (todaySummary.consumed.protein_g / todaySummary.targets.protein_g) * 100 : 0)}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{todaySummary.consumed.protein_g} / {todaySummary.targets.protein_g}g</p>
                </div>
                {/* Carbs */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{t("carbs")}</span>
                    <span className={`font-semibold ${todaySummary.remaining.carbs_g <= 0 ? "text-green-600" : ""}`}>
                      {todaySummary.remaining.carbs_g > 0 ? `${todaySummary.remaining.carbs_g}g` : "✓"}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${todaySummary.remaining.carbs_g <= 0 ? "bg-green-500" : "bg-amber-500"}`}
                      style={{ width: `${Math.min(100, todaySummary.targets.carbs_g > 0 ? (todaySummary.consumed.carbs_g / todaySummary.targets.carbs_g) * 100 : 0)}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{todaySummary.consumed.carbs_g} / {todaySummary.targets.carbs_g}g</p>
                </div>
                {/* Fat */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{t("fat")}</span>
                    <span className={`font-semibold ${todaySummary.remaining.fat_g <= 0 ? "text-green-600" : ""}`}>
                      {todaySummary.remaining.fat_g > 0 ? `${todaySummary.remaining.fat_g}g` : "✓"}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${todaySummary.remaining.fat_g <= 0 ? "bg-green-500" : "bg-rose-500"}`}
                      style={{ width: `${Math.min(100, todaySummary.targets.fat_g > 0 ? (todaySummary.consumed.fat_g / todaySummary.targets.fat_g) * 100 : 0)}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{todaySummary.consumed.fat_g} / {todaySummary.targets.fat_g}g</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Streak Banner ── */}
        {streak != null && streak.longest_streak > 0 && (
          <div className="flex items-center gap-3 rounded-xl border bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800 px-4 py-3">
            <span className="text-2xl leading-none">🔥</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-sm font-bold text-amber-800 dark:text-amber-300">
                  {streak.current_streak} {t("streakDays")} {t("currentStreak").toLowerCase()}
                </span>
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  {t("bestStreak")}: {streak.longest_streak} {t("streakDays")}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── Step Intelligence ── */}
        <StepIntelligenceCard locale={locale} />

        {/* ── Data Quality Warnings ── */}
        {data && (() => {
          const noNutrition = data.todays_calories == null;
          const lastWorkoutDaysAgo = data.recent_workouts.length > 0
            ? Math.floor((Date.now() - new Date(data.recent_workouts[0].logged_at).getTime()) / 86400000)
            : null;
          const workoutWarning = lastWorkoutDaysAgo != null && lastWorkoutDaysAgo > 7;
          if (!noNutrition && !workoutWarning) return null;
          return (
            <div className="space-y-2">
              {noNutrition && (
                <div className="flex items-center gap-2.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 px-3.5 py-2.5 text-sm text-blue-700 dark:text-blue-300">
                  <Info className="h-4 w-4 shrink-0" />
                  {t("warnNoNutrition")}
                </div>
              )}
              {workoutWarning && lastWorkoutDaysAgo != null && (
                <div className="flex items-center gap-2.5 rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20 px-3.5 py-2.5 text-sm text-orange-700 dark:text-orange-300">
                  <Info className="h-4 w-4 shrink-0" />
                  {t("warnNoWorkout", { days: lastWorkoutDaysAgo })}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Plateau Warning ── */}
        {plateau?.detected && (
          <Card className="border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700">
            <CardContent className="pt-4 pb-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-yellow-800 dark:text-yellow-300 text-sm">
                  {t("plateauWarning")}
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-0.5">
                  {t("plateauDesc", {
                    days: plateau.days_checked ?? 0,
                    range: plateau.weight_range_kg ?? 0,
                  })}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Smart Insights + Ask AI ── */}
        {(intel?.insights?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {intel!.insights.map((key) => (
                <span
                  key={key}
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                    INSIGHT_COLORS[key] ?? "bg-muted text-muted-foreground"
                  }`}
                >
                  {t(key as any)}
                </span>
              ))}
            </div>
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link href={`/${locale}/ai-coach`}>
                <Bot className="h-4 w-4 mr-1.5" />
                {t("askAI")}
              </Link>
            </Button>
          </div>
        )}

        {/* Ask AI button when no insights yet */}
        {(intel?.insights?.length ?? 0) === 0 && (
          <div className="flex justify-end">
            <Button asChild variant="outline" size="sm">
              <Link href={`/${locale}/ai-coach`}>
                <Bot className="h-4 w-4 mr-1.5" />
                {t("askAI")}
              </Link>
            </Button>
          </div>
        )}

        {/* ── Health Score + Forecast ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Health Score */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Heart className="h-4 w-4 text-rose-500" />
                {t("healthScoreLabel")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {hs ? (
                <>
                  <div className="flex items-center gap-4">
                    <div className="text-5xl font-bold text-primary">{hs.total}</div>
                    <div className="flex-1">
                      <Progress value={hs.total} />
                      <p className="text-xs text-muted-foreground mt-1">{t("outOf100")}</p>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    {([
                      { label: t("weightTracking"), val: hs.weight_consistency, max: 25 },
                      { label: t("nutritionTracking"), val: hs.nutrition_consistency, max: 25 },
                      { label: t("workoutTracking"), val: hs.workout_consistency, max: 25 },
                      { label: t("goalProgressScore"), val: hs.goal_progress, max: 25 },
                    ] as const).map(({ label, val, max }) => (
                      <div key={label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-medium">{val}/{max}</span>
                        </div>
                        <Progress value={(val / max) * 100} className="h-1.5" />
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">—</p>
              )}
            </CardContent>
          </Card>

          {/* Forecast */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-blue-500" />
                {t("forecastCard")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {forecast ? (
                <div className="grid grid-cols-2 gap-3">
                  <ForecastStat
                    label={t("etaDate")}
                    value={forecast.eta_date ? formatDate(forecast.eta_date, locale) : "—"}
                    icon={<Clock className="h-3.5 w-3.5 text-purple-500" />}
                  />
                  <ForecastStat
                    label={t("scheduleStatus")}
                    value={
                      forecast.days_ahead == null
                        ? "—"
                        : forecast.days_ahead >= 7
                        ? `+${forecast.days_ahead}d`
                        : forecast.days_ahead <= -7
                        ? `${forecast.days_ahead}d`
                        : t("onSchedule")
                    }
                    valueClass={
                      forecast.days_ahead == null
                        ? ""
                        : forecast.days_ahead >= 7
                        ? "text-green-600"
                        : forecast.days_ahead <= -7
                        ? "text-red-500"
                        : "text-sky-600"
                    }
                    icon={
                      forecast.days_ahead == null ? (
                        <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : forecast.days_ahead >= 7 ? (
                        <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                      ) : forecast.days_ahead <= -7 ? (
                        <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 text-sky-500" />
                      )
                    }
                  />
                  <ForecastStat
                    label={t("weeklyChange")}
                    value={
                      forecast.weekly_change_kg != null
                        ? formatChange(forecast.weekly_change_kg, " kg")
                        : "—"
                    }
                    icon={<TrendIcon value={forecast.weekly_change_kg} />}
                  />
                  <ForecastStat
                    label={t("monthlyChange")}
                    value={
                      forecast.monthly_change_kg != null
                        ? formatChange(forecast.monthly_change_kg, " kg")
                        : "—"
                    }
                    icon={<TrendIcon value={forecast.monthly_change_kg} />}
                  />
                  <ForecastStat
                    label={t("requiredWeeklyChange")}
                    value={
                      forecast.required_weekly_change_kg != null
                        ? formatChange(forecast.required_weekly_change_kg, " kg")
                        : "—"
                    }
                    icon={<Target className="h-3.5 w-3.5 text-rose-400" />}
                  />
                  <ForecastStat
                    label={t("fatMonthlyChange")}
                    value={
                      forecast.monthly_fat_change_pct != null
                        ? formatChange(forecast.monthly_fat_change_pct, "%")
                        : "—"
                    }
                    icon={<TrendIcon value={forecast.monthly_fat_change_pct} />}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">—</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Goal Progress Engine ── */}
        {progress?.has_goal ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  {t("goalProgress")}
                </CardTitle>
                {goalTypeLabel && (
                  <span className="text-sm text-muted-foreground capitalize">{goalTypeLabel}</span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {progress.has_data ? (
                <>
                  {progress.start_weight_kg != null && (
                    <div className="flex justify-between text-sm">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">{t("startWeight")}</p>
                        <p className="font-semibold">{formatNumber(progress.start_weight_kg)} kg</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">{t("currentWeight")}</p>
                        <p className="font-bold text-primary text-base">
                          {formatNumber(progress.latest_weight_kg)} kg
                        </p>
                      </div>
                      {progress.target_weight_kg != null && (
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground mb-1">{t("targetWeight")}</p>
                          <p className="font-semibold">{formatNumber(progress.target_weight_kg)} kg</p>
                        </div>
                      )}
                    </div>
                  )}
                  {progress.progress_pct != null ? (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{t("progress")}</span>
                        <span className="font-semibold text-foreground">
                          {formatNumber(progress.progress_pct, 0)}%
                        </span>
                      </div>
                      <Progress value={progress.progress_pct ?? 0} />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("noTarget")}</p>
                  )}
                  <div className="grid grid-cols-3 gap-3 pt-1">
                    <div className="rounded-lg border bg-muted/30 px-3 py-2 text-center">
                      <p className="text-xs text-muted-foreground mb-1">{t("weeklyAvg")}</p>
                      <p className="font-semibold text-sm">
                        {progress.avg_weekly_change_kg != null
                          ? formatChange(progress.avg_weekly_change_kg, " kg")
                          : "—"}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 px-3 py-2 text-center">
                      <p className="text-xs text-muted-foreground mb-1">{t("daysRemaining")}</p>
                      <p className="font-semibold text-sm">
                        {progress.days_remaining != null ? progress.days_remaining : "—"}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 px-3 py-2 text-center">
                      <p className="text-xs text-muted-foreground mb-1">{t("estimatedCompletion")}</p>
                      <p className="font-semibold text-sm">
                        {progress.estimated_completion_date
                          ? formatDate(progress.estimated_completion_date, locale)
                          : "—"}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">{t("noGoalData")}</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground mb-3">{t("noActiveGoal")}</p>
              <Button asChild size="sm">
                <Link href={`/${locale}/goals`}>{t("setGoal")}</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Projection Chart ── */}
        {projection.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-500" />
                {t("projectionChart")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ProjectionChart
                data={projection}
                labels={{
                  actual: t("actualWeight"),
                  projected: t("projectedWeight"),
                  target: t("targetPath"),
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* ── Charts + Latest Measurements ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Scale className="h-4 w-4 text-blue-500" />
                {t("weightTrend")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TrendChart data={weightTrend} color="#3b82f6" unit=" kg" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Percent className="h-4 w-4 text-orange-500" />
                {t("fatTrend")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TrendChart data={fatTrend} color="#f97316" unit="%" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Ruler className="h-4 w-4 text-green-500" />
                {t("latestMeasurements")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data?.latest_measurement ? (
                <div className="space-y-2">
                  {[
                    { key: "chest_cm", label: "Chest" },
                    { key: "waist_cm", label: "Waist" },
                    { key: "hips_cm", label: "Hips" },
                    { key: "left_arm_cm", label: "Arm" },
                  ].map(({ key, label }) => {
                    const val = data.latest_measurement![key as keyof typeof data.latest_measurement];
                    return val != null ? (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium">{formatNumber(val)} cm</span>
                      </div>
                    ) : null;
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">—</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Latest AI Report ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-indigo-500" />
                {t("latestReport")}
              </CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/${locale}/reports`}>{t("viewReports")}</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {latestReport ? (
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{latestReport.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(latestReport.generated_at).toLocaleDateString(
                      locale === "tr" ? "tr-TR" : "en-US"
                    )}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/${locale}/reports`}>{t("viewReport")}</Link>
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{t("noReportYet")}</p>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/${locale}/reports`}>{t("generateReport")}</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Latest Progress Photo ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Camera className="h-4 w-4 text-pink-500" />
                {t("latestPhoto")}
              </CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/${locale}/photos`}>{t("viewAllPhotos")}</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {latestPhoto ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {new Date(latestPhoto.uploaded_at).toLocaleDateString(
                      locale === "tr" ? "tr-TR" : "en-US"
                    )}
                  </p>
                  <div className="flex gap-3 mt-1">
                    {latestPhoto.weight_kg != null && (
                      <span className="text-xs text-muted-foreground">{latestPhoto.weight_kg} kg</span>
                    )}
                    {latestPhoto.body_fat_pct != null && (
                      <span className="text-xs text-muted-foreground">{latestPhoto.body_fat_pct}%</span>
                    )}
                    {latestPhoto.note && (
                      <span className="text-xs text-muted-foreground truncate max-w-32">{latestPhoto.note}</span>
                    )}
                  </div>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/${locale}/photos`}>{t("viewReport")}</Link>
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{t("noPhotoYet")}</p>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/${locale}/photos`}>{t("uploadFirstPhoto")}</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Workout Intelligence Card ── */}
        {workoutIntel && workoutIntel.strongest_lift && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Brain className="h-4 w-4 text-primary" />
                  {t("workoutIntelligence")}
                </CardTitle>
                <Button asChild variant="ghost" size="sm" className="text-xs">
                  <Link href={`/${locale}/workout-intelligence`}>
                    {t("viewDetails")} →
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-muted/30 px-3 py-2.5 text-center">
                  <Trophy className="h-4 w-4 text-yellow-500 mx-auto mb-1" />
                  <p className="text-base font-bold">{workoutIntel.strongest_lift.weight_pr}kg</p>
                  <p className="text-[10px] text-muted-foreground truncate">{workoutIntel.strongest_lift.exercise_name}</p>
                </div>
                {workoutIntel.fastest_improving ? (
                  <div className="rounded-lg bg-muted/30 px-3 py-2.5 text-center">
                    <TrendingUp className="h-4 w-4 text-green-500 mx-auto mb-1" />
                    <p className="text-base font-bold text-green-600">+{workoutIntel.fastest_improving.growth_pct}%</p>
                    <p className="text-[10px] text-muted-foreground truncate">{workoutIntel.fastest_improving.exercise_name}</p>
                  </div>
                ) : (
                  <div className="rounded-lg bg-muted/30 px-3 py-2.5 text-center">
                    <TrendingUp className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                    <p className="text-base font-bold">—</p>
                    <p className="text-[10px] text-muted-foreground">{t("noTrend")}</p>
                  </div>
                )}
                <div className={`rounded-lg px-3 py-2.5 text-center ${
                  workoutIntel.plateaus.length > 0
                    ? "bg-yellow-50 dark:bg-yellow-900/10"
                    : "bg-muted/30"
                }`}>
                  <AlertTriangle className={`h-4 w-4 mx-auto mb-1 ${workoutIntel.plateaus.length > 0 ? "text-yellow-500" : "text-muted-foreground"}`} />
                  <p className={`text-base font-bold ${workoutIntel.plateaus.length > 0 ? "text-yellow-600" : ""}`}>
                    {workoutIntel.plateaus.length}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{t("plateaus")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Coach Feed ── */}
        <CoachFeedCard locale={locale} />

        {/* ── Recent Workouts ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5" />
              {t("recentWorkouts")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.recent_workouts.length ? (
              <ul className="divide-y">
                {data.recent_workouts.map((w) => (
                  <li key={w.id} className="py-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-sm">{w.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(w.logged_at).toLocaleDateString(
                          locale === "tr" ? "tr-TR" : "en-US"
                        )}
                      </p>
                    </div>
                    {w.duration_minutes && (
                      <span className="text-sm text-muted-foreground">{w.duration_minutes} min</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">—</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        </div>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function ForecastStat({
  label,
  value,
  icon,
  valueClass = "",
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-1 mb-1">
        {icon}
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className={`font-semibold text-sm ${valueClass}`}>{value}</p>
    </div>
  );
}
