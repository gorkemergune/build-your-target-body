"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendChart } from "@/components/charts/TrendChart";
import { EmptyState } from "@/components/tracking/EmptyState";
import { StatsBar } from "@/components/tracking/StatsBar";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import type { NutritionLog, FoodEntry } from "@/types";
import { Utensils, ChevronLeft, ChevronRight, Trash2, ScanLine, AlertCircle, BookOpen, BookMarked, X as XIcon, Barcode } from "lucide-react";
import { FoodScanModal } from "@/components/nutrition/FoodScanModal";
import { FoodLibraryModal } from "@/components/nutrition/FoodLibraryModal";
import { BarcodeScannerModal } from "@/components/nutrition/BarcodeScannerModal";

type MealTab = "breakfast" | "lunch" | "dinner" | "snack" | "notes";
const MEAL_TYPES: MealTab[] = ["breakfast", "lunch", "dinner", "snack", "notes"];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function offsetDate(base: string, delta: number): string {
  const d = new Date(base + "T12:00:00");
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function formatDisplayDate(iso: string, locale: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString(
    locale === "tr" ? "tr-TR" : "en-US",
    { weekday: "short", year: "numeric", month: "short", day: "numeric" }
  );
}

export default function NutritionPage({ params: { locale } }: { params: { locale: string } }) {
  const t = useTranslations("nutrition");
  const tc = useTranslations("common");

  const [currentDate, setCurrentDate] = useState(todayStr());
  const [log, setLog] = useState<NutritionLog | null>(null);
  const [history, setHistory] = useState<NutritionLog[]>([]);
  const [trendData, setTrendData] = useState<{ date: string; value: number }[]>([]);
  const [proteinTrendData, setProteinTrendData] = useState<{ date: string; value: number }[]>([]);

  // Macro form
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [water, setWater] = useState("");
  const [macroSaving, setMacroSaving] = useState(false);

  // Food journal
  const [activeTab, setActiveTab] = useState<MealTab>("breakfast");
  const [foodName, setFoodName] = useState("");
  const [foodQty, setFoodQty] = useState("");
  const [foodCal, setFoodCal] = useState("");
  const [foodProtein, setFoodProtein] = useState("");
  const [foodCarbs, setFoodCarbs] = useState("");
  const [foodFat, setFoodFat] = useState("");
  const [foodAdding, setFoodAdding] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState<number | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Notes
  const [dailyNotes, setDailyNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);

  // Nutrition targets
  const [todaySummary, setTodaySummary] = useState<any>(null);

  const fetchLog = useCallback(() => {
    api
      .get(`/api/v1/nutrition/${currentDate}`)
      .then((r) => {
        setLog(r.data);
        setCalories(r.data.total_calories?.toString() ?? "");
        setProtein(r.data.protein_g?.toString() ?? "");
        setCarbs(r.data.carbs_g?.toString() ?? "");
        setFat(r.data.fat_g?.toString() ?? "");
        setWater(r.data.water_ml?.toString() ?? "");
        setDailyNotes(r.data.daily_notes ?? "");
      })
      .catch(() => {
        setLog(null);
        setCalories(""); setProtein(""); setCarbs(""); setFat(""); setWater("");
        setDailyNotes("");
      });
  }, [currentDate]);

  useEffect(() => {
    fetchLog();
  }, [fetchLog]);

  useEffect(() => {
    api.get("/api/v1/nutrition?days=30").then((r) => setHistory(r.data));
    api.get("/api/v1/analytics/calorie-trend?days=30").then((r) => setTrendData(r.data));
    api.get("/api/v1/analytics/protein-trend?days=30").then((r) => setProteinTrendData(r.data));
    api.get("/api/v1/nutrition/today-summary").then((r) => setTodaySummary(r.data)).catch(() => {});
  }, []);

  async function handleSaveMacros(e: React.FormEvent) {
    e.preventDefault();
    setMacroSaving(true);
    try {
      await api.post("/api/v1/nutrition", {
        logged_date: currentDate,
        total_calories: calories ? parseFloat(calories) : undefined,
        protein_g: protein ? parseFloat(protein) : undefined,
        carbs_g: carbs ? parseFloat(carbs) : undefined,
        fat_g: fat ? parseFloat(fat) : undefined,
        water_ml: water ? parseFloat(water) : undefined,
      });
      fetchLog();
      api.get("/api/v1/analytics/calorie-trend?days=30").then((r) => setTrendData(r.data));
      api.get("/api/v1/analytics/protein-trend?days=30").then((r) => setProteinTrendData(r.data));
      api.get("/api/v1/nutrition/today-summary").then((r) => setTodaySummary(r.data)).catch(() => {});
    } finally { setMacroSaving(false); }
  }

  async function handleSaveNotes() {
    setNotesSaving(true);
    try {
      await api.post("/api/v1/nutrition", {
        logged_date: currentDate,
        daily_notes: dailyNotes,
      });
      fetchLog();
    } finally { setNotesSaving(false); }
  }

  async function handleAddFood(e: React.FormEvent) {
    e.preventDefault();
    if (!foodName.trim()) return;
    setFoodAdding(true);
    try {
      let currentLog = log;
      if (!currentLog) {
        const res = await api.post("/api/v1/nutrition", { logged_date: currentDate });
        currentLog = res.data;
        setLog(res.data);
      }
      await api.post(`/api/v1/nutrition/${currentLog!.id}/foods`, {
        meal_type: activeTab,
        food_name: foodName.trim(),
        quantity_g: foodQty ? parseFloat(foodQty) : undefined,
        calories: foodCal ? parseFloat(foodCal) : undefined,
        protein_g: foodProtein ? parseFloat(foodProtein) : undefined,
        carbs_g: foodCarbs ? parseFloat(foodCarbs) : undefined,
        fat_g: foodFat ? parseFloat(foodFat) : undefined,
      });
      setFoodName(""); setFoodQty(""); setFoodCal("");
      setFoodProtein(""); setFoodCarbs(""); setFoodFat("");
      fetchLog();
    } finally { setFoodAdding(false); }
  }

  async function handleDeleteEntry(entryId: number) {
    if (!log || !confirm(tc("deleteConfirm"))) return;
    setDeletingEntry(entryId);
    try {
      await api.delete(`/api/v1/nutrition/${log.id}/foods/${entryId}`);
      fetchLog();
    } finally { setDeletingEntry(null); }
  }

  async function handleSaveTemplate() {
    if (!templateName.trim() || entriesForTab.length === 0) return;
    setSavingTemplate(true);
    try {
      const items = entriesForTab.map((e) => ({
        food_name: e.food_name,
        calories: e.calories,
        protein_g: e.protein_g,
        carbs_g: e.carbs_g,
        fat_g: e.fat_g,
        quantity_g: e.quantity_g,
        food_item_id: e.food_item_id,
      }));
      await api.post("/api/v1/meal-templates", { name: templateName.trim(), items });
      setTemplateName("");
      setSaveTemplateOpen(false);
    } finally {
      setSavingTemplate(false);
    }
  }

  const entriesForTab = log?.food_entries.filter((e) => e.meal_type === activeTab) ?? [];

  const macroStats = log
    ? [
        { label: t("calories"), value: log.total_calories != null ? `${Math.round(log.total_calories)} kcal` : "—" },
        { label: t("protein"), value: log.protein_g != null ? `${formatNumber(log.protein_g)} g` : "—" },
        { label: t("carbs"), value: log.carbs_g != null ? `${formatNumber(log.carbs_g)} g` : "—" },
        { label: t("fat"), value: log.fat_g != null ? `${formatNumber(log.fat_g)} g` : "—" },
      ]
    : [];

  const isToday = currentDate === todayStr();

  return (
    <AppLayout locale={locale}>
      <div className="space-y-6">
        {scanOpen && (
          <FoodScanModal
            locale={locale}
            currentDate={currentDate}
            onSaved={() => { setScanOpen(false); fetchLog(); }}
            onClose={() => setScanOpen(false)}
          />
        )}

        {barcodeOpen && (
          <BarcodeScannerModal
            locale={locale}
            currentDate={currentDate}
            mealType={activeTab === "notes" ? "snack" : activeTab}
            logId={log?.id ?? null}
            onAdded={() => {
              fetchLog();
              api.get("/api/v1/nutrition/today-summary").then((r) => setTodaySummary(r.data)).catch(() => {});
            }}
            onClose={() => setBarcodeOpen(false)}
            onCreateCustom={() => setLibraryOpen(true)}
          />
        )}

        {libraryOpen && (
          <FoodLibraryModal
            locale={locale}
            currentDate={currentDate}
            mealType={activeTab === "notes" ? "snack" : activeTab}
            logId={log?.id ?? null}
            onAdded={() => {
              fetchLog();
              api.get("/api/v1/nutrition/today-summary").then((r) => setTodaySummary(r.data)).catch(() => {});
            }}
            onClose={() => setLibraryOpen(false)}
          />
        )}

        {/* ── Daily Targets Card ── */}
        {todaySummary && todaySummary.targets_available && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Utensils className="h-4 w-4 text-primary" />
                {t("dailyTargets")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Calorie range bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t("consumed")}: <span className="font-semibold text-foreground">{todaySummary.consumed.calories} kcal</span></span>
                  <span>{t("target")}: <span className="font-semibold text-foreground">{todaySummary.targets.calories} kcal</span></span>
                </div>
                <div className="relative h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      todaySummary.consumed.calories > todaySummary.targets.max_calories
                        ? "bg-red-500"
                        : todaySummary.consumed.calories >= todaySummary.targets.calories
                        ? "bg-green-500"
                        : "bg-primary"
                    }`}
                    style={{ width: `${Math.min(100, (todaySummary.consumed.calories / todaySummary.targets.calories) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{t("min")}: {todaySummary.targets.min_calories}</span>
                  <span className={`font-medium ${todaySummary.remaining.calories === 0 ? "text-green-600" : "text-foreground"}`}>
                    {todaySummary.remaining.calories > 0 ? `${t("remaining")}: ${todaySummary.remaining.calories} kcal` : `✓ ${t("targetMet")}`}
                  </span>
                  <span>{t("max")}: {todaySummary.targets.max_calories}</span>
                </div>
              </div>

              {/* Macro bars */}
              <div className="grid grid-cols-3 gap-3">
                {(["protein_g", "carbs_g", "fat_g"] as const).map((macro) => {
                  const labels: Record<string, string> = { protein_g: t("protein"), carbs_g: t("carbs"), fat_g: t("fat") };
                  const colors: Record<string, string> = { protein_g: "bg-blue-500", carbs_g: "bg-amber-500", fat_g: "bg-rose-500" };
                  const consumed = todaySummary.consumed[macro];
                  const target = todaySummary.targets[macro];
                  const pct = Math.min(100, target > 0 ? Math.round((consumed / target) * 100) : 0);
                  return (
                    <div key={macro} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{labels[macro]}</span>
                        <span className="font-medium">{consumed}g</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full ${colors[macro]}`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground text-right">{t("of")} {target}g</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {todaySummary && !todaySummary.targets_available && (
          <div className="flex items-center gap-2.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-3.5 py-2.5 text-sm text-amber-700 dark:text-amber-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{t("targetsIncomplete")}{" "}</span>
            <Link href={`/${locale}/profile`} className="underline font-medium">{t("completeProfile")}</Link>
          </div>
        )}

        {/* Header with date navigation */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => setBarcodeOpen(true)}
            >
              <Barcode className="h-3.5 w-3.5" />
              {locale === "tr" ? "Barkod" : "Barcode"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => setScanOpen(true)}
            >
              <ScanLine className="h-3.5 w-3.5" />
              {locale === "tr" ? "Fotoğrafla Tara" : "Scan Photo"}
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8"
              onClick={() => setCurrentDate((d) => offsetDate(d, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[180px] text-center">
              {formatDisplayDate(currentDate, locale)}
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8"
              disabled={isToday}
              onClick={() => setCurrentDate((d) => offsetDate(d, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Macro stats */}
        {log && macroStats.length > 0 && <StatsBar stats={macroStats} />}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Macro form */}
          <Card>
            <CardHeader><CardTitle>{t("logNutrition")}</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSaveMacros} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    [t("calories"), calories, setCalories, "0", "20000", "1"],
                    [t("protein"), protein, setProtein, "0", "1000", "0.1"],
                    [t("carbs"), carbs, setCarbs, "0", "2000", "0.1"],
                    [t("fat"), fat, setFat, "0", "1000", "0.1"],
                    [t("water"), water, setWater, "0", "10000", "1"],
                  ].map(([label, value, setter, min, max, step]: any) => (
                    <div key={label} className="space-y-1">
                      <Label className="text-xs">{label}</Label>
                      <Input
                        type="number" step={step} min={min} max={max}
                        value={value}
                        onChange={(e) => setter(e.target.value)}
                      />
                    </div>
                  ))}
                </div>
                <Button type="submit" disabled={macroSaving} className="w-full">
                  {macroSaving ? "..." : t("saveMacros")}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Calorie trend */}
          <Card>
            <CardHeader><CardTitle className="text-base">{t("calorieTrend")}</CardTitle></CardHeader>
            <CardContent>
              <TrendChart data={trendData} color="#f97316" unit=" kcal" />
            </CardContent>
          </Card>
        </div>

        {/* Food Journal */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">{t("addFood")}</CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => setLibraryOpen(true)}
              >
                <BookOpen className="h-3.5 w-3.5" />
                {t("openLibrary")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Tabs */}
            <div className="flex gap-1 flex-wrap">
              {MEAL_TYPES.map((tab) => (
                <Button
                  key={tab}
                  variant={activeTab === tab ? "default" : "outline"}
                  size="sm"
                  className="text-xs"
                  onClick={() => setActiveTab(tab)}
                >
                  {t(tab as any)}
                </Button>
              ))}
            </div>

            {/* Notes tab */}
            {activeTab === "notes" ? (
              <div className="space-y-3">
                <textarea
                  className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder={t("dailyNotes")}
                  value={dailyNotes}
                  onChange={(e) => setDailyNotes(e.target.value)}
                />
                <Button onClick={handleSaveNotes} disabled={notesSaving} size="sm">
                  {notesSaving ? "..." : t("saveNotes")}
                </Button>
                {log?.daily_notes && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap border rounded-md p-3 bg-muted/30">
                    {log.daily_notes}
                  </p>
                )}
              </div>
            ) : (
              <>
                {/* Food entry form */}
                <form onSubmit={handleAddFood} className="space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Input
                      placeholder={t("foodName")}
                      value={foodName}
                      onChange={(e) => setFoodName(e.target.value)}
                      required
                      className="col-span-2 sm:col-span-2"
                    />
                    <Input
                      placeholder={t("quantity")}
                      type="number" step="0.1" min="0"
                      value={foodQty}
                      onChange={(e) => setFoodQty(e.target.value)}
                    />
                    <Input
                      placeholder={t("foodCalories")}
                      type="number" step="1" min="0"
                      value={foodCal}
                      onChange={(e) => setFoodCal(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      placeholder={t("foodProtein")}
                      type="number" step="0.1" min="0"
                      value={foodProtein}
                      onChange={(e) => setFoodProtein(e.target.value)}
                    />
                    <Input
                      placeholder={t("foodCarbs")}
                      type="number" step="0.1" min="0"
                      value={foodCarbs}
                      onChange={(e) => setFoodCarbs(e.target.value)}
                    />
                    <Input
                      placeholder={t("foodFat")}
                      type="number" step="0.1" min="0"
                      value={foodFat}
                      onChange={(e) => setFoodFat(e.target.value)}
                    />
                  </div>
                  <Button type="submit" disabled={foodAdding} size="sm">
                    {foodAdding ? "..." : t("addFood")}
                  </Button>
                </form>

                {/* Entries for this meal */}
                {entriesForTab.length > 0 ? (
                  <div className="space-y-2">
                    <div className="divide-y rounded-md border">
                      {entriesForTab.map((entry) => (
                        <FoodEntryRow
                          key={entry.id}
                          entry={entry}
                          deleting={deletingEntry === entry.id}
                          onDelete={() => handleDeleteEntry(entry.id)}
                        />
                      ))}
                    </div>
                    {/* Save as Template */}
                    {!saveTemplateOpen ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs gap-1.5 text-muted-foreground"
                        onClick={() => setSaveTemplateOpen(true)}
                      >
                        <BookMarked className="h-3.5 w-3.5" />
                        {t("saveAsTemplate")}
                      </Button>
                    ) : (
                      <div className="flex gap-2 items-center">
                        <Input
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                          placeholder={t("templateNamePlaceholder")}
                          className="h-7 text-xs flex-1"
                          autoFocus
                          onKeyDown={(e) => { if (e.key === "Enter") handleSaveTemplate(); if (e.key === "Escape") setSaveTemplateOpen(false); }}
                        />
                        <Button size="sm" className="h-7 px-2.5 text-xs" disabled={savingTemplate || !templateName.trim()} onClick={handleSaveTemplate}>
                          {savingTemplate ? "..." : t("save")}
                        </Button>
                        <button onClick={() => { setSaveTemplateOpen(false); setTemplateName(""); }} className="p-1 text-muted-foreground hover:text-foreground">
                          <XIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">—</p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Protein trend + History */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">{t("proteinTrend")}</CardTitle></CardHeader>
            <CardContent>
              <TrendChart data={proteinTrendData} color="#3b82f6" unit=" g" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">{t("history")}</CardTitle></CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <EmptyState
                  icon={Utensils}
                  title={t("emptyTitle")}
                  description={t("emptyDescription")}
                />
              ) : (
                <div className="divide-y max-h-64 overflow-y-auto">
                  {history.map((h) => (
                    <div key={h.id} className="py-2 flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">
                        {new Date(h.logged_date + "T12:00:00").toLocaleDateString(
                          locale === "tr" ? "tr-TR" : "en-US",
                          { month: "short", day: "numeric" }
                        )}
                      </span>
                      <div className="flex gap-4 text-right">
                        {h.total_calories != null && (
                          <span className="font-medium">{Math.round(h.total_calories)} kcal</span>
                        )}
                        {h.protein_g != null && (
                          <span className="text-muted-foreground">{formatNumber(h.protein_g)}g P</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

function FoodEntryRow({
  entry,
  deleting,
  onDelete,
}: {
  entry: FoodEntry;
  deleting: boolean;
  onDelete: () => void;
}) {
  return (
    <div className="py-2 px-3 flex justify-between items-center text-sm">
      <div>
        <span className="font-medium">{entry.food_name}</span>
        {entry.quantity_g != null && (
          <span className="ml-1 text-xs text-muted-foreground">{entry.quantity_g}g</span>
        )}
        <div className="flex gap-2 text-xs text-muted-foreground mt-0.5">
          {entry.calories != null && <span>{Math.round(entry.calories)} kcal</span>}
          {entry.protein_g != null && <span>{formatNumber(entry.protein_g)}g P</span>}
          {entry.carbs_g != null && <span>{formatNumber(entry.carbs_g)}g C</span>}
          {entry.fat_g != null && <span>{formatNumber(entry.fat_g)}g F</span>}
        </div>
      </div>
      <Button
        variant="ghost" size="icon"
        className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
        disabled={deleting}
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
