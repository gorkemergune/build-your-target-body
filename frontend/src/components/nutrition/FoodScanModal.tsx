"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import {
  Camera,
  Loader2,
  X,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ScanLine,
  ImagePlus,
  Info,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DetectedFood {
  name: string;
  estimated_serving: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface ScanResult {
  scan_log_id: number;
  photo_token: string;
  foods: DetectedFood[];
  totals: { calories: number; protein: number; carbs: number; fat: number };
  confidence: number;
  notes: string;
}

interface Props {
  locale: string;
  currentDate: string;
  onSaved: () => void;
  onClose: () => void;
}

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
type MealType = (typeof MEAL_TYPES)[number];

// ── Image resize ──────────────────────────────────────────────────────────────

async function resizeImage(file: File, maxPx = 1280): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { width, height } = img;
      const scale = Math.min(1, maxPx / Math.max(width, height));
      const w = Math.round(width * scale);
      const h = Math.round(height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Canvas export failed"))),
        "image/jpeg",
        0.85
      );
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── Confidence badge ──────────────────────────────────────────────────────────

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const cls =
    pct >= 80
      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
      : pct >= 55
      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
      : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cls}`}>
      {pct}%
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function FoodScanModal({ locale, currentDate, onSaved, onClose }: Props) {
  const t = useTranslations("foodScan");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [foods, setFoods] = useState<DetectedFood[]>([]);
  const [mealType, setMealType] = useState<MealType>("lunch");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── File handling ───────────────────────────────────────────────────────────

  async function handleFile(file: File) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError(t("wrongType"));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(t("fileTooLarge"));
      return;
    }
    setError(null);
    setResult(null);
    setFoods([]);
    setSaved(false);

    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);
    setSelectedFile(file);

    // Auto-analyze immediately on file selection
    await analyzeFile(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  // ── Analysis ────────────────────────────────────────────────────────────────

  async function analyzeFile(file: File) {
    setAnalyzing(true);
    setError(null);
    try {
      const resized = await resizeImage(file, 1280);
      const fd = new FormData();
      fd.append("photo", resized, "food.jpg");
      const r = await api.post("/api/v1/nutrition/analyze-photo", fd);
      setResult(r.data);
      setFoods(r.data.foods.map((f: DetectedFood) => ({ ...f })));
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(detail || t("error"));
      setPreview(null);
      setSelectedFile(null);
    } finally {
      setAnalyzing(false);
    }
  }

  // ── Food editing ─────────────────────────────────────────────────────────────

  function updateFood(idx: number, field: keyof DetectedFood, value: string | number) {
    setFoods((prev) => prev.map((f, i) => (i === idx ? { ...f, [field]: value } : f)));
  }

  function removeFood(idx: number) {
    setFoods((prev) => prev.filter((_, i) => i !== idx));
  }

  function addEmptyFood() {
    setFoods((prev) => [
      ...prev,
      { name: "", estimated_serving: "", calories: 0, protein: 0, carbs: 0, fat: 0 },
    ]);
  }

  const totals = foods.reduce(
    (acc, f) => ({
      calories: acc.calories + (Number(f.calories) || 0),
      protein: acc.protein + (Number(f.protein) || 0),
      carbs: acc.carbs + (Number(f.carbs) || 0),
      fat: acc.fat + (Number(f.fat) || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  // ── Save ─────────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (foods.length === 0 || !result) return;
    setSaving(true);
    setError(null);
    try {
      await api.post("/api/v1/nutrition/scan-save", {
        scan_log_id: result.scan_log_id,
        logged_date: currentDate,
        meal_type: mealType,
        foods: foods
          .filter((f) => f.name.trim())
          .map((f) => ({
            name: f.name.trim(),
            calories: f.calories || undefined,
            protein_g: f.protein || undefined,
            carbs_g: f.carbs || undefined,
            fat_g: f.fat || undefined,
            estimated_serving: f.estimated_serving || undefined,
          })),
      });
      setSaved(true);
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.detail || t("error"));
    } finally {
      setSaving(false);
    }
  }

  function handleRetake() {
    setResult(null);
    setFoods([]);
    setPreview(null);
    setSelectedFile(null);
    setError(null);
    setSaved(false);
  }

  // ── Meal type labels ──────────────────────────────────────────────────────────

  const mealLabels: Record<MealType, string> =
    locale === "tr"
      ? { breakfast: "Kahvaltı", lunch: "Öğle", dinner: "Akşam", snack: "Ara öğün" }
      : { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full sm:max-w-2xl bg-background rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92dvh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-primary" />
            <div>
              <p className="font-semibold text-sm">{t("modalTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("modalSubtitle")}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">

          {/* ── Upload zone ── */}
          {!preview && !analyzing && (
            <div className="space-y-3">
              {/* Drag-and-drop / click to upload */}
              <div
                className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/20"
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <ImagePlus className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                  {dragOver ? t("dropzoneActive") : t("dropzone")}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">JPEG · PNG · WebP · max 10 MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  onChange={handleFileInput}
                  className="hidden"
                />
              </div>

              {/* Mobile camera button */}
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="h-4 w-4" />
                {t("takePhoto")}
              </Button>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>
          )}

          {/* ── Preview + analyzing spinner ── */}
          {(preview || analyzing) && (
            <div className="space-y-3">
              {preview && (
                <div className="relative">
                  <img
                    src={preview}
                    alt="food preview"
                    className="w-full max-h-52 object-cover rounded-xl border"
                  />
                  {result && (
                    <div className="absolute top-2 left-2 flex items-center gap-1.5">
                      <span className="bg-black/60 text-white rounded-full px-2 py-0.5 text-xs font-medium">
                        {t("confidence")}
                      </span>
                      <ConfidenceBadge value={result.confidence} />
                    </div>
                  )}
                  {!result && !analyzing && (
                    <button
                      onClick={handleRetake}
                      className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5 hover:bg-black/80"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}

              {analyzing && (
                <div className="flex items-center justify-center gap-3 py-6 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-sm font-medium">{t("analyzing")}</span>
                </div>
              )}
            </div>
          )}

          {/* ── Error ── */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-3 py-2.5 text-sm text-red-700 dark:text-red-300">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* ── Detected foods table ── */}
          {result && !analyzing && (
            <div className="space-y-3">

              {/* Gemini notes */}
              {result.notes && (
                <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{result.notes}</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{t("detected")} ({foods.length})</p>
                <p className="text-xs text-muted-foreground">{t("editableHint")}</p>
              </div>

              {foods.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{t("noFoods")}</p>
              ) : (
                <div className="space-y-2">
                  {/* Column headers */}
                  <div className="grid grid-cols-[1fr_58px_50px_50px_50px_30px] gap-1.5 px-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    <span>{t("foodName")}</span>
                    <span className="text-center">{t("cal")}</span>
                    <span className="text-center">{t("protein")}</span>
                    <span className="text-center">{t("carbs")}</span>
                    <span className="text-center">{t("fat")}</span>
                    <span />
                  </div>

                  {foods.map((food, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_58px_50px_50px_50px_30px] gap-1.5 items-start">
                      <div className="space-y-0.5">
                        <Input
                          className="h-8 text-xs"
                          value={food.name}
                          onChange={(e) => updateFood(idx, "name", e.target.value)}
                          placeholder={t("foodName")}
                        />
                        {food.estimated_serving && (
                          <p className="text-[10px] text-muted-foreground pl-1 leading-tight">
                            ~{food.estimated_serving}
                          </p>
                        )}
                      </div>
                      <Input
                        className="h-8 text-xs text-center"
                        type="number" min={0}
                        value={food.calories}
                        onChange={(e) => updateFood(idx, "calories", Number(e.target.value))}
                      />
                      <Input
                        className="h-8 text-xs text-center"
                        type="number" min={0}
                        value={food.protein}
                        onChange={(e) => updateFood(idx, "protein", Number(e.target.value))}
                      />
                      <Input
                        className="h-8 text-xs text-center"
                        type="number" min={0}
                        value={food.carbs}
                        onChange={(e) => updateFood(idx, "carbs", Number(e.target.value))}
                      />
                      <Input
                        className="h-8 text-xs text-center"
                        type="number" min={0}
                        value={food.fat}
                        onChange={(e) => updateFood(idx, "fat", Number(e.target.value))}
                      />
                      <button
                        onClick={() => removeFood(idx)}
                        className="flex items-center justify-center h-8 w-7 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}

                  {/* Totals */}
                  <div className="grid grid-cols-[1fr_58px_50px_50px_50px_30px] gap-1.5 border-t pt-2 items-center">
                    <span className="text-xs font-semibold text-muted-foreground pl-1">{t("totals")}</span>
                    <span className="text-xs font-bold text-center text-orange-600 dark:text-orange-400">{totals.calories}</span>
                    <span className="text-xs font-bold text-center text-blue-600 dark:text-blue-400">{totals.protein}g</span>
                    <span className="text-xs font-bold text-center text-amber-600 dark:text-amber-400">{totals.carbs}g</span>
                    <span className="text-xs font-bold text-center text-rose-600 dark:text-rose-400">{totals.fat}g</span>
                    <span />
                  </div>
                </div>
              )}

              <Button variant="outline" size="sm" onClick={addEmptyFood} className="w-full text-xs">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                {t("addFood")}
              </Button>

              {/* Meal type */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">{t("mealType")}</p>
                <div className="flex gap-1.5 flex-wrap">
                  {MEAL_TYPES.map((m) => (
                    <button
                      key={m}
                      onClick={() => setMealType(m)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        mealType === m
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {mealLabels[m]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Success ── */}
          {saved && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 px-3 py-2.5 text-sm text-green-700 dark:text-green-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {t("saveSuccess")}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t shrink-0 flex gap-2">
          {result && !saved ? (
            <>
              <Button variant="outline" size="sm" onClick={handleRetake} className="flex-1">
                {t("retake")}
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || foods.filter((f) => f.name.trim()).length === 0}
                className="flex-1"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    {t("saving")}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                    {t("saveBtn")}
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={onClose} className="flex-1">
              {saved ? (locale === "tr" ? "Kapat" : "Close") : t("cancel")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
