"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import {
  Footprints,
  TrendingUp,
  TrendingDown,
  Minus,
  Trophy,
  Flame,
  Star,
  AlertTriangle,
  Zap,
  Bot,
} from "lucide-react";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface DailyStepRecord {
  date: string;
  steps: number;
  source: string;
}

interface StepAnalytics {
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

interface StepAchievement {
  key: string;
  title: string;
  description: string;
  icon: string;
  unlocked_at: string;
  notes: string | null;
}

interface StepCoaching {
  recommendation: string;
  warning: string | null;
  movement_goal: string;
  coaching_source: string;
}

const ACHIEVEMENT_ICONS: Record<string, React.ReactNode> = {
  footprints: <Footprints className="h-4 w-4" />,
  "trending-up": <TrendingUp className="h-4 w-4" />,
  trophy: <Trophy className="h-4 w-4" />,
  flame: <Flame className="h-4 w-4" />,
  star: <Star className="h-4 w-4" />,
};

function CircularProgress({ pct, steps, goal }: { pct: number; steps: number | null; goal: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const filled = c * Math.min(pct / 100, 1);

  return (
    <div className="relative flex items-center justify-center">
      <svg width="128" height="128" className="-rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
        <circle
          cx="64" cy="64" r={r} fill="none"
          stroke={pct >= 100 ? "#10b981" : "#8b5cf6"}
          strokeWidth="8"
          strokeDasharray={`${filled} ${c}`}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-extrabold leading-none text-foreground">
          {steps != null ? (steps >= 1000 ? `${(steps / 1000).toFixed(1)}k` : steps) : "—"}
        </span>
        <span className="text-[10px] text-muted-foreground mt-0.5">/ {(goal / 1000).toFixed(0)}k</span>
      </div>
    </div>
  );
}

export function StepIntelligenceCard({ locale }: { locale: string }) {
  const [analytics, setAnalytics] = useState<StepAnalytics | null>(null);
  const [achievements, setAchievements] = useState<StepAchievement[]>([]);
  const [coaching, setCoaching] = useState<StepCoaching | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const lang = locale === "tr" ? "tr" : "en";
    Promise.allSettled([
      api.get("/api/v1/steps/analytics"),
      api.get("/api/v1/steps/achievements"),
      api.get(`/api/v1/steps/coaching?language=${lang}`),
    ]).then(([a, ach, c]) => {
      if (a.status === "fulfilled") setAnalytics(a.value.data);
      if (ach.status === "fulfilled") setAchievements(ach.value.data);
      if (c.status === "fulfilled") setCoaching(c.value.data);
      setLoading(false);
    });
    // Check/unlock achievements in background
    api.post("/api/v1/steps/check-achievements").catch(() => {});
  }, [locale]);

  if (loading) {
    return (
      <Card>
        <CardContent className="h-32 flex items-center justify-center text-muted-foreground text-sm">
          Loading step data…
        </CardContent>
      </Card>
    );
  }

  if (!analytics) return null;

  const wow = analytics.week_over_week_pct;
  const chartData = analytics.daily_history
    .slice(0, 14)
    .reverse()
    .map((d) => ({
      date: d.date.slice(5), // MM-DD
      steps: d.steps,
    }));

  const goal = analytics.today_goal;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Footprints className="h-4 w-4 text-violet-500" />
          Step Intelligence
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Top: circular progress + today stats */}
        <div className="flex items-center gap-6">
          <CircularProgress pct={analytics.today_pct} steps={analytics.today_steps} goal={goal} />

          <div className="flex-1 grid grid-cols-2 gap-3">
            <Stat label="Today" value={analytics.today_steps?.toLocaleString() ?? "—"} sub="steps" />
            <Stat
              label="Remaining"
              value={analytics.remaining_today != null && analytics.remaining_today > 0
                ? analytics.remaining_today.toLocaleString()
                : analytics.today_steps != null && analytics.today_steps >= goal ? "Done ✓" : "—"
              }
              sub={analytics.remaining_today != null && analytics.remaining_today > 0 ? "to goal" : ""}
              accent={analytics.remaining_today === 0}
            />
            <Stat label="This Week" value={analytics.this_week_total.toLocaleString()} sub="steps" />
            <Stat label="Daily Avg" value={`${Math.round(analytics.this_week_avg_daily).toLocaleString()}`} sub="steps" />
          </div>
        </div>

        {/* Week-over-week badge */}
        {wow != null && (
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
            wow >= 0
              ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400"
              : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400"
          }`}>
            {wow > 0 ? <TrendingUp className="h-4 w-4" /> : wow < 0 ? <TrendingDown className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
            <span>
              {wow > 0 ? "+" : ""}{wow.toFixed(1)}% vs last week
            </span>
            <span className="text-muted-foreground font-normal ml-auto">
              {analytics.last_week_total > 0 ? `${analytics.last_week_total.toLocaleString()} last week` : ""}
            </span>
          </div>
        )}

        {/* Monthly total */}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">This month</span>
          <span className="font-semibold">{analytics.this_month_total.toLocaleString()} steps</span>
        </div>

        {/* 14-day bar chart */}
        {chartData.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Last 14 days</p>
            <ResponsiveContainer width="100%" height={72}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barCategoryGap="20%">
                <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(v: number) => [v.toLocaleString(), "steps"]}
                  contentStyle={{ fontSize: 11, padding: "4px 8px" }}
                />
                <Bar dataKey="steps" radius={[3, 3, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.steps >= goal ? "#10b981" : entry.steps >= goal * 0.75 ? "#8b5cf6" : "#6b7280"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* AI Coaching */}
        {coaching && (
          <div className="rounded-xl border bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800 p-3 space-y-2">
            <div className="flex items-center gap-1.5">
              <Bot className="h-3.5 w-3.5 text-violet-600" />
              <span className="text-[10px] font-semibold text-violet-600 uppercase tracking-wide">
                {coaching.coaching_source === "ai" ? "AI Coach" : "Coach"}
              </span>
            </div>
            {coaching.warning && (
              <div className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <p>{coaching.warning}</p>
              </div>
            )}
            <p className="text-sm text-foreground leading-snug">{coaching.recommendation}</p>
            <div className="flex items-start gap-1.5">
              <Zap className="h-3.5 w-3.5 text-violet-500 mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">{coaching.movement_goal}</p>
            </div>
          </div>
        )}

        {/* Achievements */}
        {achievements.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Achievements</p>
            <div className="flex flex-wrap gap-2">
              {achievements.map((a) => (
                <div
                  key={a.key}
                  title={a.description + (a.notes ? `\n${a.notes}` : "")}
                  className="flex items-center gap-1.5 rounded-full border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400"
                >
                  <span className="text-amber-500">{ACHIEVEMENT_ICONS[a.icon] ?? <Trophy className="h-4 w-4" />}</span>
                  {a.title}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
      <p className={`text-lg font-bold leading-none ${accent ? "text-green-600" : "text-foreground"}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
