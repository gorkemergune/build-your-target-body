"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ChefHat,
  Sparkles,
  ShoppingCart,
  Download,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader2,
  Clock,
  Flame,
  Beef,
  Wheat,
  Droplets,
  History,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FoodItem {
  name: string;
  amount: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface Meal {
  meal_type: string;
  name: string;
  foods: FoodItem[];
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
}

interface PlanDay {
  day: number;
  meals: Meal[];
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
}

interface ShoppingCategory {
  category: string;
  items: string[];
}

interface MealPlan {
  id: number;
  plan_type: string;
  duration_days: number;
  preferences: string[];
  plan: { days: PlanDay[] };
  ai_coach_notes: string | null;
  calorie_target: number | null;
  protein_g_target: number | null;
  carbs_g_target: number | null;
  fat_g_target: number | null;
  created_at: string;
}

type PlanType = "cut" | "bulk" | "recomp" | "maintenance";
type Preference = "vegetarian" | "high_protein" | "budget";
type Tab = "plan" | "shopping" | "history";

// ── Helper components ─────────────────────────────────────────────────────────

function MacroChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${color}`}>
      {label} {value}g
    </span>
  );
}

function DayCard({ day, dayIndex }: { day: PlanDay; dayIndex: number }) {
  const [open, setOpen] = useState(dayIndex === 0);

  return (
    <Card className="overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm">Day {day.day}</span>
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{day.total_calories} kcal</span>
            <MacroChip label="P" value={day.total_protein_g} color="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" />
            <MacroChip label="C" value={day.total_carbs_g} color="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" />
            <MacroChip label="F" value={day.total_fat_g} color="bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" />
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <CardContent className="px-4 pb-4 space-y-4 border-t pt-3">
          {day.meals.map((meal) => (
            <div key={meal.meal_type} className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                    {meal.meal_type}
                  </span>
                  <p className="text-sm font-medium">{meal.name}</p>
                </div>
                <span className="text-xs text-muted-foreground">{meal.total_calories} kcal</span>
              </div>
              <div className="space-y-1 pl-2 border-l-2 border-muted">
                {meal.foods.map((food, fi) => (
                  <div key={fi} className="flex items-start justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      <span className="text-foreground font-medium">{food.name}</span>{" "}
                      <span className="text-[11px]">({food.amount})</span>
                    </span>
                    <span className="shrink-0">{food.calories} kcal</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="pt-2 border-t flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Flame className="h-3 w-3 text-orange-500" />{day.total_calories} kcal</span>
            <span className="flex items-center gap-1"><Beef className="h-3 w-3 text-blue-500" />{day.total_protein_g}g protein</span>
            <span className="flex items-center gap-1"><Wheat className="h-3 w-3 text-amber-500" />{day.total_carbs_g}g carbs</span>
            <span className="flex items-center gap-1"><Droplets className="h-3 w-3 text-purple-500" />{day.total_fat_g}g fat</span>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MealPlannerPage() {
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations("mealPlanner");

  const [planType, setPlanType] = useState<PlanType>("cut");
  const [durationDays, setDurationDays] = useState(7);
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentPlan, setCurrentPlan] = useState<MealPlan | null>(null);
  const [savedPlans, setSavedPlans] = useState<MealPlan[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [shoppingList, setShoppingList] = useState<ShoppingCategory[]>([]);
  const [loadingShop, setLoadingShop] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>("plan");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get<MealPlan[]>("/api/v1/meal-plans");
      setSavedPlans(res.data);
      if (res.data.length > 0) {
        setCurrentPlan(res.data[0]);
      }
    } catch {
      // silently ignore
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const fetchShoppingList = async (planId: number) => {
    setLoadingShop(true);
    try {
      const res = await api.get<{ categories: ShoppingCategory[] }>(
        `/api/v1/meal-plans/${planId}/shopping-list`
      );
      setShoppingList(res.data.categories || []);
    } catch {
      // silently ignore
    } finally {
      setLoadingShop(false);
    }
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === "shopping" && currentPlan && shoppingList.length === 0) {
      fetchShoppingList(currentPlan.id);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setShoppingList([]);

    try {
      const res = await api.post<MealPlan>("/api/v1/meal-plans/generate", {
        plan_type: planType,
        duration_days: durationDays,
        preferences,
      });
      const plan = res.data;
      setCurrentPlan(plan);
      setSavedPlans((prev) => [plan, ...prev.filter((p) => p.id !== plan.id)]);
      setActiveTab("plan");
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: unknown } } };
      const detail = axiosErr?.response?.data?.detail;
      if (detail && typeof detail === "object" && (detail as Record<string, unknown>).message) {
        setError((detail as Record<string, string>).message);
      } else if (typeof detail === "string") {
        setError(detail);
      } else {
        setError(t("generateError"));
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (planId: number) => {
    setDeletingId(planId);
    try {
      await api.delete(`/api/v1/meal-plans/${planId}`);
      const remaining = savedPlans.filter((p) => p.id !== planId);
      setSavedPlans(remaining);
      if (currentPlan?.id === planId) {
        setCurrentPlan(remaining[0] ?? null);
        setShoppingList([]);
      }
    } catch {
      // silently ignore
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportPdf = async () => {
    if (!currentPlan) return;
    try {
      const res = await api.get(`/api/v1/meal-plans/${currentPlan.id}/export-pdf`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `meal-plan-${currentPlan.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently ignore
    }
  };

  const planTypeOptions: { value: PlanType; label: string; desc: string }[] = [
    { value: "cut", label: t("typeCut"), desc: t("typeCutDesc") },
    { value: "bulk", label: t("typeBulk"), desc: t("typeBulkDesc") },
    { value: "recomp", label: t("typeRecomp"), desc: t("typeRecompDesc") },
    { value: "maintenance", label: t("typeMaintenance"), desc: t("typeMaintenanceDesc") },
  ];

  const prefOptions: { value: Preference; label: string }[] = [
    { value: "vegetarian", label: t("prefVegetarian") },
    { value: "high_protein", label: t("prefHighProtein") },
    { value: "budget", label: t("prefBudget") },
  ];

  const togglePref = (pref: Preference) => {
    setPreferences((prev) =>
      prev.includes(pref) ? prev.filter((p) => p !== pref) : [...prev, pref]
    );
  };

  const typeLabels: Record<string, string> = {
    cut: t("typeCut"),
    bulk: t("typeBulk"),
    recomp: t("typeRecomp"),
    maintenance: t("typeMaintenance"),
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-24">
      <div className="flex items-center gap-3">
        <ChefHat className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      {/* Generator form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {t("generateTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Plan type */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("planType")}</label>
            <div className="grid grid-cols-2 gap-2">
              {planTypeOptions.map(({ value, label, desc }) => (
                <button
                  key={value}
                  onClick={() => setPlanType(value)}
                  className={`text-left p-3 rounded-lg border text-sm transition-colors ${
                    planType === value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="font-semibold">{label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("duration")}</label>
            <div className="flex gap-2">
              {[1, 3, 5, 7].map((d) => (
                <button
                  key={d}
                  onClick={() => setDurationDays(d)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    durationDays === d
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {d === 1 ? t("day1") : t("days", { count: d })}
                </button>
              ))}
            </div>
          </div>

          {/* Preferences */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("preferences")}</label>
            <div className="flex flex-wrap gap-2">
              {prefOptions.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => togglePref(value)}
                  className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                    preferences.includes(value)
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <Button onClick={handleGenerate} disabled={generating} className="w-full">
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("generating")}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                {t("generate")}
              </>
            )}
          </Button>
          {generating && (
            <p className="text-xs text-center text-muted-foreground">{t("generatingNote")}</p>
          )}
        </CardContent>
      </Card>

      {/* Plan viewer */}
      {currentPlan && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h2 className="font-semibold text-lg">
                {currentPlan.duration_days === 1 ? t("day1") : t("days", { count: currentPlan.duration_days })}{" "}
                {typeLabels[currentPlan.plan_type] ?? currentPlan.plan_type}
                {" "}{t("plan")}
              </h2>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(currentPlan.created_at).toLocaleDateString(locale)}
                {currentPlan.calorie_target && (
                  <span className="ml-2">{currentPlan.calorie_target} kcal/day</span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleExportPdf}>
                <Download className="h-3.5 w-3.5 mr-1" />
                PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => handleDelete(currentPlan.id)}
                disabled={deletingId === currentPlan.id}
              >
                {deletingId === currentPlan.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b">
            {(["plan", "shopping", "history"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "plan" && t("tabPlan")}
                {tab === "shopping" && (
                  <span className="flex items-center gap-1.5">
                    <ShoppingCart className="h-3.5 w-3.5" />
                    {t("tabShopping")}
                  </span>
                )}
                {tab === "history" && (
                  <span className="flex items-center gap-1.5">
                    <History className="h-3.5 w-3.5" />
                    {t("tabHistory")}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Plan tab */}
          {activeTab === "plan" && (
            <div className="space-y-3">
              {currentPlan.ai_coach_notes && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="py-3 px-4">
                    <p className="text-sm flex items-start gap-2">
                      <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{currentPlan.ai_coach_notes}</span>
                    </p>
                  </CardContent>
                </Card>
              )}
              {currentPlan.plan?.days?.map((day, i) => (
                <DayCard key={day.day} day={day} dayIndex={i} />
              ))}
            </div>
          )}

          {/* Shopping tab */}
          {activeTab === "shopping" && (
            <div className="space-y-4">
              {loadingShop ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : shoppingList.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">{t("noShoppingList")}</p>
              ) : (
                shoppingList.map((cat) => (
                  <Card key={cat.category}>
                    <CardHeader className="pb-2 pt-3 px-4">
                      <CardTitle className="text-sm font-semibold">{cat.category}</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                      <ul className="space-y-1">
                        {cat.items.map((item, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-primary mt-1">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* History tab */}
          {activeTab === "history" && (
            <div className="space-y-2">
              {loadingHistory ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : savedPlans.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">{t("noHistory")}</p>
              ) : (
                savedPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      currentPlan?.id === plan.id
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => {
                      setCurrentPlan(plan);
                      setShoppingList([]);
                      setActiveTab("plan");
                    }}
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {plan.duration_days === 1 ? t("day1") : t("days", { count: plan.duration_days })}{" "}
                        {typeLabels[plan.plan_type] ?? plan.plan_type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(plan.created_at).toLocaleDateString(locale)}
                        {plan.calorie_target && ` · ${plan.calorie_target} kcal`}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(plan.id);
                      }}
                      disabled={deletingId === plan.id}
                    >
                      {deletingId === plan.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty state when no plans yet */}
      {!currentPlan && !generating && !loadingHistory && savedPlans.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-2">
            <ChefHat className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">{t("emptyTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("emptyDesc")}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
