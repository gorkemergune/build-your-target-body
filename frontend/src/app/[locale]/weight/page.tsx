"use client";

import { useEffect, useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendChart } from "@/components/charts/TrendChart";
import { StatsBar } from "@/components/tracking/StatsBar";
import { EmptyState } from "@/components/tracking/EmptyState";
import { api } from "@/lib/api";
import { formatNumber, formatChange, todayISO, localeDateToISO } from "@/lib/utils";
import type { WeightLog } from "@/types";
import { Scale, Trash2 } from "lucide-react";

type Period = "30" | "90" | "all";

export default function WeightPage({ params: { locale } }: { params: { locale: string } }) {
  const t = useTranslations("weight");
  const tc = useTranslations("common");
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [weight, setWeight] = useState("");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<Period>("30");
  const [deleting, setDeleting] = useState<number | null>(null);

  const fetchLogs = () => api.get("/api/v1/weight").then((r) => setLogs(r.data));
  useEffect(() => { fetchLogs(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/api/v1/weight", {
        weight_kg: parseFloat(weight),
        logged_at: localeDateToISO(date),
        notes: notes || undefined,
      });
      setWeight("");
      setDate(todayISO());
      setNotes("");
      fetchLogs();
    } finally { setLoading(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm(tc("deleteConfirm"))) return;
    setDeleting(id);
    try {
      await api.delete(`/api/v1/weight/${id}`);
      fetchLogs();
    } finally { setDeleting(null); }
  }

  const stats = useMemo(() => {
    if (!logs.length) return null;
    const sorted = [...logs].sort(
      (a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime()
    );
    const latest = sorted[sorted.length - 1];
    const first = sorted[0];
    const change = latest.weight_kg - first.weight_kg;
    let weeklyAvg: number | null = null;
    if (sorted.length >= 2) {
      const days =
        (new Date(latest.logged_at).getTime() - new Date(first.logged_at).getTime()) /
        (1000 * 60 * 60 * 24);
      if (days >= 7) weeklyAvg = (change / days) * 7;
    }
    return { latest: latest.weight_kg, change, weeklyAvg, total: logs.length };
  }, [logs]);

  const chartData = useMemo(() => {
    const sorted = [...logs].sort(
      (a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime()
    );
    if (period === "all") {
      return sorted.map((l) => ({ date: l.logged_at.slice(0, 10), value: l.weight_kg }));
    }
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (period === "30" ? 30 : 90));
    return sorted
      .filter((l) => new Date(l.logged_at) >= cutoff)
      .map((l) => ({ date: l.logged_at.slice(0, 10), value: l.weight_kg }));
  }, [logs, period]);

  const statItems = stats
    ? [
        { label: t("latest"), value: `${formatNumber(stats.latest)} kg` },
        { label: t("totalChange"), value: formatChange(stats.change, " kg"), highlight: true },
        { label: t("weeklyAvg"), value: formatChange(stats.weeklyAvg, " kg") },
        { label: t("totalLogs"), value: String(stats.total) },
      ]
    : [];

  return (
    <AppLayout locale={locale}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{t("title")}</h1>

        {stats && <StatsBar stats={statItems} />}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>{t("logWeight")}</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("weightKg")}</Label>
                  <Input
                    type="number" step="0.1" min="20" max="500"
                    inputMode="decimal"
                    value={weight} onChange={(e) => setWeight(e.target.value)} required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("date")}</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>{t("notes")}</Label>
                  <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "..." : t("logWeight")}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t("trend")}</CardTitle>
                <div className="flex gap-1">
                  {(["30", "90", "all"] as Period[]).map((p) => (
                    <Button
                      key={p}
                      variant={period === p ? "default" : "outline"}
                      size="sm"
                      className="px-2 py-1 text-xs h-7"
                      onClick={() => setPeriod(p)}
                    >
                      {p === "30" ? t("last30") : p === "90" ? t("last90") : t("allTime")}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <TrendChart data={chartData} color="#3b82f6" unit=" kg" />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">—</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>{t("history")}</CardTitle></CardHeader>
          <CardContent>
            {!logs.length ? (
              <EmptyState
                icon={Scale}
                title={t("emptyTitle")}
                description={t("emptyDescription")}
              />
            ) : (
              <div className="divide-y">
                {logs.map((l) => (
                  <div key={l.id} className="py-3 flex justify-between items-center">
                    <div>
                      <p className="font-semibold">{l.weight_kg} kg</p>
                      {l.notes && <p className="text-xs text-muted-foreground mt-0.5">{l.notes}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        {new Date(l.logged_at).toLocaleDateString(
                          locale === "tr" ? "tr-TR" : "en-US",
                          { year: "numeric", month: "short", day: "numeric" }
                        )}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        disabled={deleting === l.id}
                        onClick={() => handleDelete(l.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
