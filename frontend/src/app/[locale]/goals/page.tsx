"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import {
  Target,
  CheckCircle2,
  Loader2,
  Zap,
  Shield,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Bot,
  Wand2,
  Settings2,
} from "lucide-react";

const GOAL_TYPES = ["weight_loss", "weight_gain", "recomp", "muscle_gain"] as const;
type GoalType = (typeof GOAL_TYPES)[number];

const ACTIVITY_LEVELS = [
  "sedentary",
  "lightly_active",
  "moderately_active",
  "very_active",
  "extremely_active",
] as const;

interface Scenario {
  label: "conservative" | "balanced" | "aggressive";
  weeks_to_goal: number;
  target_date: string;
  weekly_change_kg: number;
  daily_calories: number;
  caloric_adjustment: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  risk_level: "low" | "medium" | "high";
  warnings: string[];
}

interface PlanResult {
  tdee: number;
  bmr: number;
  weight_change_needed_kg: number;
  scenarios: Scenario[];
}

const SCENARIO_STYLES = {
  conservative: {
    icon: Shield,
    color: "text-blue-600",
    border: "border-blue-200 dark:border-blue-800",
    badge: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  },
  balanced: {
    icon: Target,
    color: "text-green-600",
    border: "border-green-200 dark:border-green-800",
    badge: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
  },
  aggressive: {
    icon: Zap,
    color: "text-orange-600",
    border: "border-orange-200 dark:border-orange-800",
    badge: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
  },
};

const RISK_COLORS = {
  low: "text-green-600",
  medium: "text-amber-500",
  high: "text-red-500",
};

// ── Macro bar ─────────────────────────────────────────────────────────
function MacroBar({
  protein_g,
  carbs_g,
  fat_g,
}: {
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}) {
  const total = protein_g * 4 + carbs_g * 4 + fat_g * 9;
  const pPct = total > 0 ? (protein_g * 4 / total) * 100 : 0;
  const cPct = total > 0 ? (carbs_g * 4 / total) * 100 : 0;
  const fPct = 100 - pPct - cPct;
  return (
    <div className="flex rounded-full overflow-hidden h-2 w-full gap-px">
      <div className="bg-blue-500 transition-all" style={{ width: `${pPct}%` }} title={`Protein ${protein_g}g`} />
      <div className="bg-amber-400 transition-all" style={{ width: `${cPct}%` }} title={`Carbs ${carbs_g}g`} />
      <div className="bg-rose-400 transition-all" style={{ width: `${fPct}%` }} title={`Fat ${fat_g}g`} />
    </div>
  );
}

// ── Scenario card ─────────────────────────────────────────────────────
function ScenarioCard({
  s,
  locale,
  goalType,
  currentWeight,
  targetWeight,
  onApply,
  applying,
  t,
  tp,
}: {
  s: Scenario;
  locale: string;
  goalType: string;
  currentWeight: number;
  targetWeight: number;
  onApply: () => void;
  applying: boolean;
  t: ReturnType<typeof useTranslations>;
  tp: ReturnType<typeof useTranslations>;
}) {
  const style = SCENARIO_STYLES[s.label];
  const Icon = style.icon;
  const [explainOpen, setExplainOpen] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);

  async function loadExplanation() {
    if (explanation !== null) {
      setExplainOpen(!explainOpen);
      return;
    }
    setExplainOpen(true);
    setExplaining(true);
    try {
      const r = await api.post("/api/v1/goals/plan/explain", {
        scenario: s,
        goal_type: goalType,
        current_weight_kg: currentWeight,
        target_weight_kg: targetWeight,
        language: locale,
      });
      setExplanation(r.data.explanation);
    } catch {
      setExplanation(t("explainError"));
    } finally {
      setExplaining(false);
    }
  }

  const sign = s.weekly_change_kg > 0 ? "+" : "";
  return (
    <Card className={`border-2 ${style.border} transition-shadow hover:shadow-md`}>
      <CardContent className="pt-5 pb-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${style.color}`} />
            <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${style.badge}`}>
              {t(s.label)}
            </span>
          </div>
          <span className={`text-xs font-medium ${RISK_COLORS[s.risk_level]}`}>
            {t(`risk_${s.risk_level}`)}
          </span>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <p className="text-xs text-muted-foreground">{t("timeline")}</p>
            <p className="font-bold text-lg leading-tight">{Math.round(s.weeks_to_goal)}w</p>
            <p className="text-xs text-muted-foreground">
              {new Date(s.target_date + "T12:00:00").toLocaleDateString(
                locale === "tr" ? "tr-TR" : "en-US",
                { month: "short", year: "numeric" }
              )}
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <p className="text-xs text-muted-foreground">{t("weeklyRate")}</p>
            <p className="font-bold text-lg leading-tight">
              {sign}{Math.abs(s.weekly_change_kg).toFixed(2)} kg
            </p>
            <p className="text-xs text-muted-foreground">{t("perWeek")}</p>
          </div>
        </div>

        {/* Calories */}
        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
          <div>
            <p className="text-xs text-muted-foreground">{t("dailyCalories")}</p>
            <p className="font-bold">{s.daily_calories} kcal</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{t("adjustment")}</p>
            <p className={`text-sm font-semibold ${s.caloric_adjustment < 0 ? "text-blue-600" : "text-green-600"}`}>
              {s.caloric_adjustment > 0 ? "+" : ""}{s.caloric_adjustment} kcal
            </p>
          </div>
        </div>

        {/* Macros */}
        <div className="space-y-1.5">
          <MacroBar protein_g={s.protein_g} carbs_g={s.carbs_g} fat_g={s.fat_g} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span><span className="font-semibold text-blue-600">{s.protein_g}g</span> {tp("protein")}</span>
            <span><span className="font-semibold text-amber-500">{s.carbs_g}g</span> {tp("carbs")}</span>
            <span><span className="font-semibold text-rose-500">{s.fat_g}g</span> {tp("fat")}</span>
          </div>
        </div>

        {/* Warnings */}
        {s.warnings.length > 0 && (
          <div className="space-y-1">
            {s.warnings.map((w) => (
              <div key={w} className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                {t(`warn_${w}`)}
              </div>
            ))}
          </div>
        )}

        {/* AI Explanation */}
        <button
          onClick={loadExplanation}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Bot className="h-3.5 w-3.5" />
          {t("explainPlan")}
          {explainOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {explainOpen && (
          <div className="rounded-lg bg-muted/40 border px-3 py-2.5 text-xs text-muted-foreground leading-relaxed">
            {explaining ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("explainLoading")}
              </div>
            ) : (
              <p className="whitespace-pre-line">{explanation}</p>
            )}
          </div>
        )}

        {/* Apply */}
        <Button
          className="w-full"
          onClick={onApply}
          disabled={applying}
          variant={s.label === "balanced" ? "default" : "outline"}
        >
          {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : t("applyPlan")}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────
export default function GoalsPage({ params: { locale } }: { params: { locale: string } }) {
  const t = useTranslations("goalPlanner");
  const tg = useTranslations("goals");
  const tn = useTranslations("nutrition");

  const [activeGoal, setActiveGoal] = useState<any>(null);
  const [mode, setMode] = useState<"planner" | "manual">("planner");

  // Planner inputs
  const [currentWeight, setCurrentWeight] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [goalType, setGoalType] = useState<GoalType>("weight_loss");
  const [activityLevel, setActivityLevel] = useState("moderately_active");
  const [trainingDays, setTrainingDays] = useState("3");

  // Results
  const [planResult, setPlanResult] = useState<PlanResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [applyingLabel, setApplyingLabel] = useState<string | null>(null);

  // Manual form (legacy)
  const [mStartWeight, setMStartWeight] = useState("");
  const [mTargetWeight, setMTargetWeight] = useState("");
  const [mStartFat, setMStartFat] = useState("");
  const [mTargetFat, setMTargetFat] = useState("");
  const [mTargetDate, setMTargetDate] = useState("");
  const [mGoalType, setMGoalType] = useState("weight_loss");
  const [mSaving, setMSaving] = useState(false);

  const fetchGoal = () =>
    api.get("/api/v1/goals/active")
      .then((r) => setActiveGoal(r.data))
      .catch(() => setActiveGoal(null));

  useEffect(() => { fetchGoal(); }, []);

  async function handleCalculate(e: React.FormEvent) {
    e.preventDefault();
    setCalcError(null);
    setPlanResult(null);
    setCalculating(true);
    try {
      const r = await api.post("/api/v1/goals/plan", {
        current_weight_kg: parseFloat(currentWeight),
        target_weight_kg: parseFloat(targetWeight),
        height_cm: parseFloat(heightCm),
        age: parseInt(age),
        gender,
        goal_type: goalType,
        activity_level: activityLevel,
        training_frequency_per_week: parseInt(trainingDays),
      });
      setPlanResult(r.data);
    } catch (err: any) {
      setCalcError(err?.response?.data?.detail || t("calcError"));
    } finally {
      setCalculating(false);
    }
  }

  async function applyScenario(s: Scenario) {
    setApplyingLabel(s.label);
    try {
      await api.post("/api/v1/goals/", {
        goal_type: goalType,
        start_weight_kg: parseFloat(currentWeight),
        target_weight_kg: parseFloat(targetWeight),
        target_date: s.target_date + "T12:00:00.000Z",
      });
      fetchGoal();
      setPlanResult(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
    } finally {
      setApplyingLabel(null);
    }
  }

  async function handleManualSave(e: React.FormEvent) {
    e.preventDefault();
    setMSaving(true);
    try {
      await api.post("/api/v1/goals/", {
        goal_type: mGoalType,
        start_weight_kg: mStartWeight ? parseFloat(mStartWeight) : undefined,
        target_weight_kg: mTargetWeight ? parseFloat(mTargetWeight) : undefined,
        start_body_fat_pct: mStartFat ? parseFloat(mStartFat) : undefined,
        target_body_fat_pct: mTargetFat ? parseFloat(mTargetFat) : undefined,
        target_date: mTargetDate ? new Date(mTargetDate + "T12:00:00").toISOString() : undefined,
      });
      fetchGoal();
    } finally {
      setMSaving(false);
    }
  }

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().slice(0, 10);

  return (
    <AppLayout locale={locale}>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <div className="flex gap-1 rounded-lg border p-1 bg-muted/30">
            <button
              onClick={() => setMode("planner")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors
                ${mode === "planner" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Wand2 className="h-3.5 w-3.5" />
              {t("smartPlanner")}
            </button>
            <button
              onClick={() => setMode("manual")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors
                ${mode === "manual" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Settings2 className="h-3.5 w-3.5" />
              {t("manualMode")}
            </button>
          </div>
        </div>

        {/* Active goal */}
        {activeGoal && (
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">{tg("activeGoal")}</span>
                <span className="ml-auto text-xs text-muted-foreground capitalize">
                  {tg(activeGoal.goal_type as any)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                {activeGoal.target_weight_kg && (
                  <div>
                    <p className="text-xs text-muted-foreground">{tg("target")}</p>
                    <p className="font-bold">{activeGoal.target_weight_kg} kg</p>
                  </div>
                )}
                {activeGoal.target_date && (
                  <div>
                    <p className="text-xs text-muted-foreground">{tg("deadline")}</p>
                    <p className="font-bold text-sm">{formatDate(activeGoal.target_date, locale)}</p>
                  </div>
                )}
                {activeGoal.target_body_fat_pct && (
                  <div>
                    <p className="text-xs text-muted-foreground">{tg("targetFat")}</p>
                    <p className="font-bold">{activeGoal.target_body_fat_pct}%</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── SMART PLANNER MODE ── */}
        {mode === "planner" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wand2 className="h-4 w-4 text-primary" />
                  {t("yourStats")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCalculate} className="space-y-5">
                  {/* Goal type */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {tg("goalType")}
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {GOAL_TYPES.map((gt) => (
                        <button
                          key={gt}
                          type="button"
                          onClick={() => { setGoalType(gt); setPlanResult(null); }}
                          className={`rounded-md border px-2 py-2 text-xs font-medium transition-colors text-center
                            ${goalType === gt
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input hover:bg-accent"
                            }`}
                        >
                          {tg(gt as any)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Body stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">{t("currentWeight")}</Label>
                      <div className="relative">
                        <Input
                          type="number" step="0.1" min="20" max="300" required
                          placeholder="80"
                          value={currentWeight}
                          onChange={(e) => { setCurrentWeight(e.target.value); setPlanResult(null); }}
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">kg</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t("targetWeight")}</Label>
                      <div className="relative">
                        <Input
                          type="number" step="0.1" min="20" max="300" required
                          placeholder="72"
                          value={targetWeight}
                          onChange={(e) => { setTargetWeight(e.target.value); setPlanResult(null); }}
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">kg</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t("height")}</Label>
                      <div className="relative">
                        <Input
                          type="number" step="1" min="100" max="250" required
                          placeholder="175"
                          value={heightCm}
                          onChange={(e) => { setHeightCm(e.target.value); setPlanResult(null); }}
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">cm</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t("age")}</Label>
                      <Input
                        type="number" step="1" min="16" max="100" required
                        placeholder="30"
                        value={age}
                        onChange={(e) => { setAge(e.target.value); setPlanResult(null); }}
                      />
                    </div>
                  </div>

                  {/* Gender */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("gender")}
                    </Label>
                    <div className="flex gap-2">
                      {(["male", "female"] as const).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setGender(g)}
                          className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors
                            ${gender === g ? "border-primary bg-primary text-primary-foreground" : "border-input hover:bg-accent"}`}
                        >
                          {t(g)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Activity + Training */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t("activityLevel")}</Label>
                      <select
                        value={activityLevel}
                        onChange={(e) => { setActivityLevel(e.target.value); setPlanResult(null); }}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {ACTIVITY_LEVELS.map((al) => (
                          <option key={al} value={al}>{t(`act_${al}`)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t("trainingDays")}</Label>
                      <div className="flex gap-1">
                        {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => { setTrainingDays(String(n)); setPlanResult(null); }}
                            className={`flex-1 rounded-md border py-2 text-xs font-medium transition-colors
                              ${trainingDays === String(n)
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-input hover:bg-accent"
                              }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {calcError && (
                    <p className="text-sm text-destructive flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4" />
                      {calcError}
                    </p>
                  )}

                  <Button type="submit" className="w-full" disabled={calculating}>
                    {calculating ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("calculating")}</>
                    ) : (
                      <><TrendingUp className="h-4 w-4 mr-2" />{t("calculateBtn")}</>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Results */}
            {planResult && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold">{t("scenarios")}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("tdeeInfo", { tdee: planResult.tdee, bmr: planResult.bmr })}
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {planResult.weight_change_needed_kg > 0 ? "+" : ""}{planResult.weight_change_needed_kg} kg {t("toChange")}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {planResult.scenarios.map((s) => (
                    <ScenarioCard
                      key={s.label}
                      s={s}
                      locale={locale}
                      goalType={goalType}
                      currentWeight={parseFloat(currentWeight)}
                      targetWeight={parseFloat(targetWeight)}
                      onApply={() => applyScenario(s)}
                      applying={applyingLabel === s.label}
                      t={t}
                      tp={tn}
                    />
                  ))}
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  {t("disclaimer")}
                </p>
              </div>
            )}
          </>
        )}

        {/* ── MANUAL MODE ── */}
        {mode === "manual" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                {tg("createGoal")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleManualSave} className="space-y-5">
                <div className="space-y-2">
                  <Label>{tg("goalType")}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {GOAL_TYPES.map((gt) => (
                      <button
                        key={gt}
                        type="button"
                        onClick={() => setMGoalType(gt)}
                        className={`rounded-md border px-3 py-2.5 text-sm font-medium transition-colors text-left
                          ${mGoalType === gt
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input bg-background hover:bg-accent"
                          }`}
                      >
                        {tg(gt as any)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>{tg("startWeight")}</Label>
                    <Input type="number" step="0.1" min="20" max="500"
                      value={mStartWeight} onChange={(e) => setMStartWeight(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{tg("targetWeight")}</Label>
                    <Input type="number" step="0.1" min="20" max="500"
                      value={mTargetWeight} onChange={(e) => setMTargetWeight(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{tg("startBodyFat")}</Label>
                    <Input type="number" step="0.1" min="1" max="70"
                      value={mStartFat} onChange={(e) => setMStartFat(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{tg("targetBodyFat")}</Label>
                    <Input type="number" step="0.1" min="1" max="70"
                      value={mTargetFat} onChange={(e) => setMTargetFat(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>{tg("targetDate")}</Label>
                  <Input type="date" min={minDateStr}
                    value={mTargetDate} onChange={(e) => setMTargetDate(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={mSaving}>
                  {mSaving ? "..." : tg("createGoal")}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
