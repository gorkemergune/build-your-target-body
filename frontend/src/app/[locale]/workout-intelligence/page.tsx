"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Trophy, TrendingUp, TrendingDown, AlertTriangle, Minus,
  Sparkles, Loader2, Dumbbell, ArrowUpRight,
} from "lucide-react";
import { api } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PR {
  exercise_name: string;
  weight_pr: number;
  weight_pr_date: string;
  rep_pr: number;
  rep_pr_date: string;
  volume_pr: number;
  volume_pr_date: string;
  session_count: number;
}

interface StrengthTrend {
  exercise_name: string;
  recent_avg_weight: number;
  previous_avg_weight: number;
  growth_pct: number;
  recent_sessions: number;
}

interface Plateau {
  exercise_name: string;
  status: "plateau" | "declining";
  sessions_checked: number;
  weeks_stagnant: number;
  last_weight: number;
  first_weight: number;
}

interface VolumePoint { week: string; total_volume: number }

interface Intelligence {
  personal_records: PR[];
  strength_trends: StrengthTrend[];
  plateaus: Plateau[];
  consistency: { total_workouts_12w: number; avg_workouts_per_week: number };
  volume_trend: VolumePoint[];
  top_lifts: { exercise_name: string; best_weight: number; date: string }[];
  fastest_improving: StrengthTrend | null;
  strongest_lift: PR | null;
}

type Tab = "prs" | "trends" | "plateaus" | "ai";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WorkoutIntelligencePage({ params: { locale } }: { params: { locale: string } }) {
  const t = useTranslations("wi");

  const [data, setData] = useState<Intelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("prs");
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [prSort, setPrSort] = useState<"weight" | "reps" | "sessions">("weight");

  useEffect(() => {
    api.get("/api/v1/analytics/workout-intelligence")
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function generateInsights() {
    if (!data) return;
    setAiLoading(true);
    setAiText(null);
    try {
      const res = await api.post("/api/v1/ai/workout-insights", {
        plateaus: data.plateaus,
        strength_trends: data.strength_trends,
        consistency: data.consistency,
        strongest_lift: data.strongest_lift,
        fastest_improving: data.fastest_improving,
        language: locale === "tr" ? "tr" : "en",
      });
      setAiText(res.data.insights);
    } catch {
      setAiText(t("aiError"));
    } finally {
      setAiLoading(false);
    }
  }

  const sortedPRs = data ? [...data.personal_records].sort((a, b) => {
    if (prSort === "weight") return b.weight_pr - a.weight_pr;
    if (prSort === "reps") return b.rep_pr - a.rep_pr;
    return b.session_count - a.session_count;
  }) : [];

  if (loading) {
    return (
      <AppLayout locale={locale}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  const isEmpty = !data || data.personal_records.length === 0;

  return (
    <AppLayout locale={locale}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
        </div>

        {isEmpty ? (
          <EmptyState locale={locale} t={t} />
        ) : (
          <>
            {/* ── Summary Row ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard
                icon={<Trophy className="h-5 w-5 text-yellow-500" />}
                label={t("strongestLift")}
                value={data!.strongest_lift ? `${data!.strongest_lift.weight_pr}kg` : "—"}
                sub={data!.strongest_lift?.exercise_name ?? ""}
              />
              <SummaryCard
                icon={<TrendingUp className="h-5 w-5 text-green-500" />}
                label={t("fastestGrowing")}
                value={data!.fastest_improving ? `+${data!.fastest_improving.growth_pct}%` : "—"}
                sub={data!.fastest_improving?.exercise_name ?? ""}
              />
              <SummaryCard
                icon={<AlertTriangle className="h-5 w-5 text-yellow-500" />}
                label={t("plateauCount")}
                value={String(data!.plateaus.length)}
                sub={data!.plateaus.length > 0 ? t("needsAttention") : t("allProgressing")}
                valueClass={data!.plateaus.length > 0 ? "text-yellow-600" : "text-green-600"}
              />
              <SummaryCard
                icon={<Dumbbell className="h-5 w-5 text-primary" />}
                label={t("consistency12w")}
                value={`${data!.consistency.avg_workouts_per_week}×`}
                sub={t("perWeek")}
              />
            </div>

            {/* ── Tabs ── */}
            <div className="flex gap-1 border-b">
              {(["prs", "trends", "plateaus", "ai"] as Tab[]).map((t2) => (
                <button
                  key={t2}
                  onClick={() => setTab(t2)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    tab === t2
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t(t2 as any)}
                  {t2 === "plateaus" && data!.plateaus.length > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full bg-yellow-500 text-white text-[10px] font-bold">
                      {data!.plateaus.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── PR Table ── */}
            {tab === "prs" && (
              <Card>
                <CardHeader className="pb-3 flex-row items-center justify-between gap-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-yellow-500" />
                    {t("personalRecords")}
                  </CardTitle>
                  <div className="flex gap-1">
                    {(["weight", "reps", "sessions"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setPrSort(s)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          prSort === s
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {t(`sort_${s}`)}
                      </button>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t("exercise")}</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">{t("weightPR")}</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">{t("repPR")}</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">{t("volumePR")}</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">{t("sessions")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {sortedPRs.map((pr, i) => (
                          <tr key={pr.exercise_name} className={i === 0 && prSort === "weight" ? "bg-yellow-50/50 dark:bg-yellow-900/10" : ""}>
                            <td className="px-4 py-2.5 font-medium">
                              {i === 0 && prSort === "weight" && <Trophy className="inline h-3 w-3 text-yellow-500 mr-1" />}
                              {pr.exercise_name}
                            </td>
                            <td className="px-4 py-2.5 text-right font-bold">
                              {pr.weight_pr}kg
                              <div className="text-[10px] text-muted-foreground font-normal">{pr.weight_pr_date}</div>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {pr.rep_pr} reps
                              <div className="text-[10px] text-muted-foreground">{pr.rep_pr_date}</div>
                            </td>
                            <td className="px-4 py-2.5 text-right text-muted-foreground hidden sm:table-cell">
                              {pr.volume_pr.toLocaleString()}kg
                            </td>
                            <td className="px-4 py-2.5 text-right text-muted-foreground hidden md:table-cell">
                              {pr.session_count}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Trends ── */}
            {tab === "trends" && (
              <div className="space-y-4">
                {/* Volume chart */}
                {data!.volume_trend.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{t("weeklyVolume")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={data!.volume_trend} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis
                            dataKey="week"
                            tick={{ fontSize: 10 }}
                            tickFormatter={(v) => v.slice(5)}
                            className="text-muted-foreground"
                            interval="preserveStartEnd"
                          />
                          <YAxis tick={{ fontSize: 10 }} width={45} className="text-muted-foreground"
                            tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                          <Tooltip
                            formatter={(v: number) => [`${v.toLocaleString()} kg`, t("volume")]}
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "6px",
                              fontSize: "12px",
                            }}
                          />
                          <Bar dataKey="total_volume" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Strength trends list */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{t("strengthGrowth")}</CardTitle>
                    <p className="text-xs text-muted-foreground">{t("strengthGrowthDesc")}</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {data!.strength_trends.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">{t("notEnoughData")}</p>
                    ) : (
                      data!.strength_trends.map((tr) => (
                        <TrendRow key={tr.exercise_name} trend={tr} t={t} />
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ── Plateaus ── */}
            {tab === "plateaus" && (
              <div className="space-y-3">
                {data!.plateaus.length === 0 ? (
                  <Card>
                    <CardContent className="py-10 text-center">
                      <TrendingUp className="h-10 w-10 text-green-500 mx-auto mb-3" />
                      <p className="font-semibold">{t("noPlateaus")}</p>
                      <p className="text-sm text-muted-foreground mt-1">{t("noPlateausDesc")}</p>
                    </CardContent>
                  </Card>
                ) : (
                  data!.plateaus.map((p) => <PlateauCard key={p.exercise_name} plateau={p} t={t} />)
                )}
              </div>
            )}

            {/* ── AI Insights ── */}
            {tab === "ai" && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      {t("aiCoachInsights")}
                    </CardTitle>
                    <Button onClick={generateInsights} disabled={aiLoading} size="sm" className="gap-1.5">
                      {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {aiLoading ? t("generating") : t("generateInsights")}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {!aiText && !aiLoading && (
                    <p className="text-sm text-muted-foreground text-center py-6">{t("aiPrompt")}</p>
                  )}
                  {aiLoading && (
                    <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
                      <Loader2 className="h-7 w-7 animate-spin" />
                      <p className="text-sm">{t("analyzing")}</p>
                    </div>
                  )}
                  {aiText && (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                        {aiText}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryCard({ icon, label, value, sub, valueClass = "" }: {
  icon: React.ReactNode; label: string; value: string; sub: string; valueClass?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-muted-foreground font-medium">{label}</span></div>
        <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>
      </CardContent>
    </Card>
  );
}

function TrendRow({ trend, t }: { trend: StrengthTrend; t: ReturnType<typeof useTranslations<"wi">> }) {
  const positive = trend.growth_pct >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <Icon className={`h-4 w-4 shrink-0 ${positive ? "text-green-500" : "text-red-500"}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{trend.exercise_name}</p>
        <p className="text-xs text-muted-foreground">
          {trend.previous_avg_weight}kg → {trend.recent_avg_weight}kg · {trend.recent_sessions} {t("sessions")}
        </p>
      </div>
      <span className={`text-sm font-bold shrink-0 ${positive ? "text-green-600" : "text-red-600"}`}>
        {positive ? "+" : ""}{trend.growth_pct}%
      </span>
    </div>
  );
}

function PlateauCard({ plateau, t }: { plateau: Plateau; t: ReturnType<typeof useTranslations<"wi">> }) {
  const isDeclining = plateau.status === "declining";
  return (
    <Card className={`border-l-4 ${isDeclining ? "border-l-red-500" : "border-l-yellow-500"}`}>
      <CardContent className="py-4 flex items-start gap-3">
        <div className={`mt-0.5 shrink-0 ${isDeclining ? "text-red-500" : "text-yellow-500"}`}>
          {isDeclining ? <TrendingDown className="h-5 w-5" /> : <Minus className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm">{plateau.exercise_name}</p>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
              isDeclining ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
            }`}>
              {isDeclining ? t("declining") : t("plateau")}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {t("stuckAt")} {plateau.last_weight}kg · {plateau.sessions_checked} {t("sessions")} · ~{plateau.weeks_stagnant}w
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isDeclining
              ? t("decliningDesc")
              : t("plateauDesc")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ locale, t }: { locale: string; t: ReturnType<typeof useTranslations<"wi">> }) {
  return (
    <Card>
      <CardContent className="py-16 flex flex-col items-center gap-4">
        <Dumbbell className="h-14 w-14 opacity-20" />
        <div className="text-center">
          <p className="font-semibold text-lg">{t("emptyTitle")}</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">{t("emptyDesc")}</p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/${locale}/workouts`}>
            <ArrowUpRight className="h-4 w-4 mr-1.5" />
            {t("goToWorkouts")}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
