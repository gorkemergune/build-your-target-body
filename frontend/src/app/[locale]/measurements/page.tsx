"use client";

import { useEffect, useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendChart } from "@/components/charts/TrendChart";
import { EmptyState } from "@/components/tracking/EmptyState";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import type { MeasurementLog } from "@/types";
import { Ruler, Trash2 } from "lucide-react";

const FIELDS = [
  "chest_cm", "waist_cm", "hips_cm", "neck_cm",
  "left_arm_cm", "right_arm_cm", "left_thigh_cm", "right_thigh_cm",
] as const;
type Field = typeof FIELDS[number];

const FIELD_COLORS: Record<Field, string> = {
  chest_cm: "#3b82f6",
  waist_cm: "#ef4444",
  hips_cm: "#a855f7",
  neck_cm: "#22c55e",
  left_arm_cm: "#f97316",
  right_arm_cm: "#f59e0b",
  left_thigh_cm: "#06b6d4",
  right_thigh_cm: "#84cc16",
};

export default function MeasurementsPage({ params: { locale } }: { params: { locale: string } }) {
  const t = useTranslations("measurements");
  const tc = useTranslations("common");
  const [logs, setLogs] = useState<MeasurementLog[]>([]);
  const [values, setValues] = useState<Partial<Record<Field, string>>>({});
  const [loading, setLoading] = useState(false);
  const [selectedField, setSelectedField] = useState<Field>("waist_cm");
  const [deleting, setDeleting] = useState<number | null>(null);

  const fieldLabels: Record<Field, string> = {
    chest_cm: t("chest_cm"),
    waist_cm: t("waist_cm"),
    hips_cm: t("hips_cm"),
    neck_cm: t("neck_cm"),
    left_arm_cm: t("left_arm_cm"),
    right_arm_cm: t("right_arm_cm"),
    left_thigh_cm: t("left_thigh_cm"),
    right_thigh_cm: t("right_thigh_cm"),
  };

  const formLabels: Record<Field, string> = {
    chest_cm: t("chest"),
    waist_cm: t("waist"),
    hips_cm: t("hips"),
    neck_cm: t("neck"),
    left_arm_cm: t("leftArm"),
    right_arm_cm: t("rightArm"),
    left_thigh_cm: t("leftThigh"),
    right_thigh_cm: t("rightThigh"),
  };

  const fetchLogs = () => api.get("/api/v1/measurements").then((r) => setLogs(r.data));
  useEffect(() => { fetchLogs(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const payload: Partial<Record<Field, number>> = {};
    for (const f of FIELDS) {
      if (values[f]) payload[f] = parseFloat(values[f]!);
    }
    try {
      await api.post("/api/v1/measurements", payload);
      setValues({});
      fetchLogs();
    } finally { setLoading(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm(tc("deleteConfirm"))) return;
    setDeleting(id);
    try {
      await api.delete(`/api/v1/measurements/${id}`);
      fetchLogs();
    } finally { setDeleting(null); }
  }

  const latest = logs[0] ?? null;

  const chartData = useMemo(() => {
    return [...logs]
      .sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime())
      .filter((l) => l[selectedField] != null)
      .map((l) => ({ date: l.logged_at.slice(0, 10), value: l[selectedField] as number }));
  }, [logs, selectedField]);

  return (
    <AppLayout locale={locale}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{t("title")}</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Log Form */}
          <Card>
            <CardHeader><CardTitle>{t("logMeasurements")}</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {FIELDS.map((f) => (
                    <div key={f} className="space-y-1">
                      <Label className="text-xs">{formLabels[f]}</Label>
                      <Input
                        type="number" step="0.1" min="10" max="300"
                        value={values[f] ?? ""}
                        onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "..." : t("logMeasurements")}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Latest + Trend */}
          <div className="space-y-4">
            {/* Latest measurements */}
            {latest && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("latestMeasurements")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    {FIELDS.map((f) =>
                      latest[f] != null ? (
                        <div key={f} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{fieldLabels[f]}</span>
                          <span className="font-semibold">{formatNumber(latest[f])} cm</span>
                        </div>
                      ) : null
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Trend chart with field selector */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{t("trend")}</CardTitle>
                  <select
                    value={selectedField}
                    onChange={(e) => setSelectedField(e.target.value as Field)}
                    className="text-xs border rounded-md px-2 py-1 bg-background text-foreground"
                  >
                    {FIELDS.map((f) => (
                      <option key={f} value={f}>{fieldLabels[f]}</option>
                    ))}
                  </select>
                </div>
              </CardHeader>
              <CardContent>
                {chartData.length > 0 ? (
                  <TrendChart data={chartData} color={FIELD_COLORS[selectedField]} unit=" cm" />
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">—</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* History */}
        <Card>
          <CardHeader><CardTitle>{t("history")}</CardTitle></CardHeader>
          <CardContent>
            {!logs.length ? (
              <EmptyState
                icon={Ruler}
                title={t("emptyTitle")}
                description={t("emptyDescription")}
              />
            ) : (
              <div className="divide-y">
                {logs.map((l) => (
                  <div key={l.id} className="py-3">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-medium text-muted-foreground">
                        {new Date(l.logged_at).toLocaleDateString(
                          locale === "tr" ? "tr-TR" : "en-US",
                          { year: "numeric", month: "short", day: "numeric" }
                        )}
                      </p>
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
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1">
                      {FIELDS.map((f) =>
                        l[f] != null ? (
                          <div key={f} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{fieldLabels[f]}</span>
                            <span className="font-medium">{l[f]} cm</span>
                          </div>
                        ) : null
                      )}
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
