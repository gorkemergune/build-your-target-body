"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users,
  Activity,
  Bot,
  AlertTriangle,
  TrendingUp,
  Zap,
  RefreshCw,
  ShieldAlert,
  ChevronRight,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

// ── helpers ──────────────────────────────────────────────────────────

async function adminFetch(path: string, adminKey: string) {
  const res = await fetch(`${API}${path}`, {
    headers: { "X-Admin-Key": adminKey },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "text-foreground",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4 flex items-start gap-3">
        <div className="p-2 rounded-lg bg-muted shrink-0">
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-2xl font-bold leading-tight ${color}`}>{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

const FEATURE_COLORS: Record<string, string> = {
  weight_log: "#3b82f6",
  workout_log: "#10b981",
  nutrition_log: "#f97316",
  photo_upload: "#8b5cf6",
  food_scan: "#ec4899",
  ai_chat: "#06b6d4",
  report_generate: "#f59e0b",
  coach_generate: "#6366f1",
  export_json: "#84cc16",
  export_csv: "#84cc16",
  export_backup: "#84cc16",
  import_data: "#f43f5e",
};

// ── main component ───────────────────────────────────────────────────

export default function AdminAnalyticsPage() {
  const [adminKey, setAdminKey] = useState("");
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const [overview, setOverview] = useState<any>(null);
  const [features, setFeatures] = useState<any>(null);
  const [retention, setRetention] = useState<any>(null);
  const [funnel, setFunnel] = useState<any>(null);
  const [errors, setErrors] = useState<any>(null);
  const [feedback, setFeedback] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(false);

  const load = useCallback(
    async (key: string) => {
      setLoading(true);
      setAuthError(false);
      try {
        const base = "/api/v1/admin/analytics";
        const [ov, ft, rt, fn, er, fb, sm] = await Promise.all([
          adminFetch(`${base}/overview`, key),
          adminFetch(`${base}/features`, key),
          adminFetch(`${base}/retention`, key),
          adminFetch(`${base}/funnel`, key),
          adminFetch(`${base}/errors`, key),
          adminFetch(`${base}/feedback-correlation`, key),
          adminFetch(`${base}/weekly-summary`, key),
        ]);
        setOverview(ov);
        setFeatures(ft);
        setRetention(rt);
        setFunnel(fn);
        setErrors(er);
        setFeedback(fb);
        setSummary(sm);
        setSavedKey(key);
        try { sessionStorage.setItem("bytb_admin_key", key); } catch {}
      } catch (e: any) {
        if (e.message === "403") setAuthError(true);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    try {
      const k = sessionStorage.getItem("bytb_admin_key");
      if (k) { setSavedKey(k); load(k); }
    } catch {}
  }, [load]);

  if (!savedKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-base">Admin Access</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {authError && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> Invalid key
              </p>
            )}
            <Input
              type="password"
              placeholder="Admin secret key"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && adminKey && load(adminKey)}
            />
            <Button
              className="w-full"
              disabled={!adminKey || loading}
              onClick={() => load(adminKey)}
            >
              {loading ? "Loading…" : "Enter"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
          <p className="text-sm text-muted-foreground">Build Your Target Body — Admin</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => load(savedKey)}
          disabled={loading}
          className="gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Overview stat cards */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={Users}
            label="Total Users"
            value={overview.users.total}
            sub={`+${overview.users.new_7d} this week`}
          />
          <StatCard
            icon={Activity}
            label="MAU / WAU / DAU"
            value={`${overview.users.mau} / ${overview.users.wau} / ${overview.users.dau}`}
            sub="30d / 7d / 1d"
            color="text-blue-600"
          />
          <StatCard
            icon={Bot}
            label="AI Usage (7d)"
            value={overview.ai_usage_7d}
            sub={`of ${overview.events_7d} total events`}
            color="text-purple-600"
          />
          <StatCard
            icon={AlertTriangle}
            label="Errors (24h)"
            value={overview.errors_24h}
            color={overview.errors_24h > 10 ? "text-red-500" : "text-foreground"}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feature usage chart */}
        {features && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                Feature Usage (30d)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {features.features.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No feature events yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={features.features}
                    layout="vertical"
                    margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      width={110}
                    />
                    <Tooltip
                      formatter={(v: number, _: string, p: any) => [
                        `${v} events (${p.payload.unique_users} users)`,
                        "Usage",
                      ]}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {features.features.map((f: any, i: number) => (
                        <Cell
                          key={i}
                          fill={FEATURE_COLORS[f.name] ?? "#94a3b8"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        )}

        {/* User Journey Funnel */}
        {funnel && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                User Journey Funnel
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {funnel.steps.map((step: any, i: number) => (
                <div key={step.step} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize text-muted-foreground">
                      {step.step.replace(/_/g, " ")}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{step.count}</span>
                      <span className="text-xs text-muted-foreground w-10 text-right">
                        {step.pct}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${step.pct}%`,
                        backgroundColor: ["#3b82f6", "#10b981", "#f97316", "#8b5cf6"][i] ?? "#94a3b8",
                      }}
                    />
                  </div>
                </div>
              ))}
              {funnel.biggest_drop_off && (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 pt-1">
                  <AlertTriangle className="h-3 w-3" />
                  Biggest drop-off: <strong>{funnel.biggest_drop_off.replace(/_/g, " ")}</strong>
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Retention */}
      {retention && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Retention Rates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              {(["d1", "d7", "d30"] as const).map((key) => {
                const r = retention[key];
                const color =
                  r.rate >= 50 ? "text-green-600" :
                  r.rate >= 25 ? "text-amber-500" : "text-red-500";
                return (
                  <div key={key} className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {key.toUpperCase()}
                    </p>
                    <p className={`text-3xl font-bold ${color}`}>{r.rate}%</p>
                    <p className="text-xs text-muted-foreground">
                      {r.retained} / {r.eligible} users
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly summary */}
        {summary && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Weekly Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Active users</p>
                  <p className="font-semibold">{summary.active_users}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">New users</p>
                  <p className="font-semibold">{summary.new_users}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Total events</p>
                  <p className="font-semibold">{summary.total_events}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Avg events/user</p>
                  <p className="font-semibold">{summary.avg_events_per_user}</p>
                </div>
              </div>

              {summary.top_features.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">Top features</p>
                  {summary.top_features.map((f: any) => (
                    <div key={f.name} className="flex items-center justify-between text-sm py-0.5">
                      <span className="flex items-center gap-1">
                        <ChevronRight className="h-3 w-3 text-green-500" />
                        {f.name.replace(/_/g, " ")}
                      </span>
                      <span className="font-medium">{f.count}</span>
                    </div>
                  ))}
                </div>
              )}

              {summary.least_used_features.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">Least used</p>
                  {summary.least_used_features.map((f: any) => (
                    <div key={f.name} className="flex items-center justify-between text-sm py-0.5">
                      <span className="flex items-center gap-1">
                        <ChevronRight className="h-3 w-3 text-red-400" />
                        {f.name.replace(/_/g, " ")}
                      </span>
                      <span className="font-medium text-muted-foreground">{f.count}</span>
                    </div>
                  ))}
                </div>
              )}

              {summary.biggest_drop_off && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Drop-off: <strong>{summary.biggest_drop_off}</strong>
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Feedback correlation */}
        {feedback && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Feedback vs Usage (30d)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground mb-3">
                {feedback.total_feedback} feedback submissions analyzed
              </p>
              {feedback.correlations
                .filter((c: any) => c.feedback_mentions > 0)
                .map((c: any) => (
                  <div key={c.feature} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {c.requested_but_ignored && (
                        <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-medium">
                          requested
                        </span>
                      )}
                      <span>{c.feature.replace(/_/g, " ")}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{c.feedback_mentions} mentions</span>
                      <span>{c.actual_usage} uses</span>
                    </div>
                  </div>
                ))}
              {feedback.correlations.filter((c: any) => c.feedback_mentions > 0).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No feedback data yet</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Error log */}
      {errors && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Recent Errors (7d)
              </CardTitle>
              <div className="flex gap-3 text-xs text-muted-foreground">
                {Object.entries(errors.by_type).map(([type, count]) => (
                  <span key={type}>
                    <strong>{count as number}</strong> {type.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {errors.recent.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No errors — great!</p>
            ) : (
              <div className="divide-y text-sm max-h-64 overflow-y-auto">
                {errors.recent.map((e: any) => (
                  <div key={e.id} className="py-2 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-red-600 dark:text-red-400">
                        {e.error_type}
                        {e.status_code ? ` (${e.status_code})` : ""}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(e.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-muted-foreground truncate">{e.message}</p>
                    {e.endpoint && (
                      <p className="text-xs text-muted-foreground/70">{e.endpoint}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {errors.top_failing_endpoints.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Top failing endpoints</p>
                {errors.top_failing_endpoints.map((e: any) => (
                  <div key={e.endpoint} className="flex justify-between text-xs py-0.5">
                    <span className="text-muted-foreground truncate max-w-[75%]">{e.endpoint}</span>
                    <span className="font-medium text-red-500">{e.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
