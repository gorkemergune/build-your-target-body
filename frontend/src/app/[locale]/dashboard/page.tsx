"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TrendChart } from "@/components/charts/TrendChart";
import { api } from "@/lib/api";
import { formatNumber, formatChange, formatDate } from "@/lib/utils";
import type { GoalProgress } from "@/types";
import { Scale, Percent, Calendar, Flame, Target, Dumbbell, Ruler, Beef, Trophy } from "lucide-react";
import Link from "next/link";

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

export default function DashboardPage({ params: { locale } }: { params: { locale: string } }) {
  const t = useTranslations("dashboard");
  const [data, setData] = useState<DashboardData | null>(null);
  const [progress, setProgress] = useState<GoalProgress | null>(null);
  const [weightTrend, setWeightTrend] = useState<{ date: string; value: number }[]>([]);
  const [fatTrend, setFatTrend] = useState<{ date: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/api/v1/analytics/dashboard"),
      api.get("/api/v1/analytics/goal-progress"),
      api.get("/api/v1/analytics/weight-trend?days=30"),
      api.get("/api/v1/analytics/fat-trend?days=30"),
    ])
      .then(([dash, prog, wt, ft]) => {
        setData(dash.data);
        setProgress(prog.data);
        setWeightTrend(wt.data);
        setFatTrend(ft.data);
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

  const goalTypeLabel =
    progress?.goal_type
      ? progress.goal_type.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : null;

  return (
    <AppLayout locale={locale}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{t("title")}</h1>

        {/* Stat Cards — Row 1 */}
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

        {/* Stat Cards — Row 2 */}
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

        {/* Goal Progress Engine */}
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
                  {/* Weight milestones */}
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

                  {/* Progress bar */}
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

                  {/* Stats row */}
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

        {/* Charts + Latest Measurements */}
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

          {/* Latest Measurements mini-card */}
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
                  {Object.values(data.latest_measurement).every((v) => v == null) && (
                    <p className="text-sm text-muted-foreground text-center py-4">—</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">—</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Workouts */}
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
    <Card>
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
