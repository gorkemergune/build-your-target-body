"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Target, CheckCircle2 } from "lucide-react";

const GOAL_TYPES = ["weight_loss", "weight_gain", "recomp", "muscle_gain"] as const;

interface FieldErrors {
  startWeight?: string;
  targetWeight?: string;
  startFat?: string;
  targetFat?: string;
  targetDate?: string;
}

export default function GoalsPage({ params: { locale } }: { params: { locale: string } }) {
  const t = useTranslations("goals");
  const [activeGoal, setActiveGoal] = useState<any>(null);
  const [goalType, setGoalType] = useState("weight_loss");
  const [startWeight, setStartWeight] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [startFat, setStartFat] = useState("");
  const [targetFat, setTargetFat] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);

  const fetchGoal = () =>
    api.get("/api/v1/goals/active")
      .then((r) => setActiveGoal(r.data))
      .catch(() => setActiveGoal(null));

  useEffect(() => { fetchGoal(); }, []);

  function validate(): boolean {
    const errors: FieldErrors = {};

    if (startWeight) {
      const w = parseFloat(startWeight);
      if (isNaN(w) || w < 20 || w > 500) errors.startWeight = t("errWeightRange");
    }
    if (targetWeight) {
      const w = parseFloat(targetWeight);
      if (isNaN(w) || w < 20 || w > 500) errors.targetWeight = t("errWeightRange");
    }
    if (startFat) {
      const f = parseFloat(startFat);
      if (isNaN(f) || f < 1 || f > 70) errors.startFat = t("errFatRange");
    }
    if (targetFat) {
      const f = parseFloat(targetFat);
      if (isNaN(f) || f < 1 || f > 70) errors.targetFat = t("errFatRange");
    }
    if (targetDate) {
      const d = new Date(targetDate + "T00:00:00");
      if (d <= new Date()) errors.targetDate = t("errDateFuture");
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError(null);
    if (!validate()) return;

    setLoading(true);
    try {
      await api.post("/api/v1/goals/", {
        goal_type: goalType,
        start_weight_kg: startWeight ? parseFloat(startWeight) : undefined,
        target_weight_kg: targetWeight ? parseFloat(targetWeight) : undefined,
        start_body_fat_pct: startFat ? parseFloat(startFat) : undefined,
        target_body_fat_pct: targetFat ? parseFloat(targetFat) : undefined,
        target_date: targetDate ? new Date(targetDate + "T12:00:00").toISOString() : undefined,
      });
      setStartWeight(""); setTargetWeight("");
      setStartFat(""); setTargetFat("");
      setTargetDate(""); setFieldErrors({});
      fetchGoal();
    } catch (err: any) {
      setApiError(err?.response?.data?.detail || "Something went wrong");
    } finally { setLoading(false); }
  }

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().slice(0, 10);

  return (
    <AppLayout locale={locale}>
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-3xl font-bold">{t("title")}</h1>

        {/* Active goal card */}
        {activeGoal && (
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                {t("activeGoal")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">{t("type")}</p>
                <p className="font-semibold text-sm">{t(activeGoal.goal_type as any)}</p>
              </div>
              {activeGoal.target_weight_kg != null && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">{t("target")}</p>
                  <p className="font-semibold text-sm">{activeGoal.target_weight_kg} kg</p>
                </div>
              )}
              {activeGoal.target_body_fat_pct != null && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">{t("targetFat")}</p>
                  <p className="font-semibold text-sm">{activeGoal.target_body_fat_pct}%</p>
                </div>
              )}
              {activeGoal.target_date && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">{t("deadline")}</p>
                  <p className="font-semibold text-sm">{formatDate(activeGoal.target_date, locale)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Create goal form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              {t("createGoal")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Goal type selector */}
              <div className="space-y-2">
                <Label>{t("goalType")}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {GOAL_TYPES.map((gt) => (
                    <button
                      key={gt}
                      type="button"
                      onClick={() => setGoalType(gt)}
                      className={`rounded-md border px-3 py-2.5 text-sm font-medium transition-colors text-left ${
                        goalType === gt
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background hover:bg-accent"
                      }`}
                    >
                      {t(gt as any)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Weight targets */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>{t("startWeight")}</Label>
                  <Input
                    type="number" step="0.1" min="20" max="500"
                    value={startWeight}
                    onChange={(e) => { setStartWeight(e.target.value); setFieldErrors((p) => ({ ...p, startWeight: undefined })); }}
                    className={fieldErrors.startWeight ? "border-destructive" : ""}
                  />
                  {fieldErrors.startWeight && (
                    <p className="text-xs text-destructive">{fieldErrors.startWeight}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>{t("targetWeight")}</Label>
                  <Input
                    type="number" step="0.1" min="20" max="500"
                    value={targetWeight}
                    onChange={(e) => { setTargetWeight(e.target.value); setFieldErrors((p) => ({ ...p, targetWeight: undefined })); }}
                    className={fieldErrors.targetWeight ? "border-destructive" : ""}
                  />
                  {fieldErrors.targetWeight && (
                    <p className="text-xs text-destructive">{fieldErrors.targetWeight}</p>
                  )}
                </div>
              </div>

              {/* Body fat targets */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>{t("startBodyFat")}</Label>
                  <Input
                    type="number" step="0.1" min="1" max="70"
                    value={startFat}
                    onChange={(e) => { setStartFat(e.target.value); setFieldErrors((p) => ({ ...p, startFat: undefined })); }}
                    className={fieldErrors.startFat ? "border-destructive" : ""}
                  />
                  {fieldErrors.startFat && (
                    <p className="text-xs text-destructive">{fieldErrors.startFat}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>{t("targetBodyFat")}</Label>
                  <Input
                    type="number" step="0.1" min="1" max="70"
                    value={targetFat}
                    onChange={(e) => { setTargetFat(e.target.value); setFieldErrors((p) => ({ ...p, targetFat: undefined })); }}
                    className={fieldErrors.targetFat ? "border-destructive" : ""}
                  />
                  {fieldErrors.targetFat && (
                    <p className="text-xs text-destructive">{fieldErrors.targetFat}</p>
                  )}
                </div>
              </div>

              {/* Target date */}
              <div className="space-y-1.5">
                <Label>{t("targetDate")}</Label>
                <Input
                  type="date"
                  min={minDateStr}
                  value={targetDate}
                  onChange={(e) => { setTargetDate(e.target.value); setFieldErrors((p) => ({ ...p, targetDate: undefined })); }}
                  className={fieldErrors.targetDate ? "border-destructive" : ""}
                />
                {fieldErrors.targetDate && (
                  <p className="text-xs text-destructive">{fieldErrors.targetDate}</p>
                )}
              </div>

              {apiError && <p className="text-sm text-destructive">{apiError}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "..." : t("createGoal")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
