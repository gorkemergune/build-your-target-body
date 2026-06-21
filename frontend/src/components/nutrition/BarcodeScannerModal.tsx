"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  X,
  Camera,
  Keyboard,
  Scan,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
  Plus,
  PackageSearch,
  Star,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BarcodeResult {
  found: boolean;
  barcode: string;
  food_name: string | null;
  brand: string | null;
  calories_per_100g: number | null;
  protein_g_per_100g: number | null;
  carbs_g_per_100g: number | null;
  fat_g_per_100g: number | null;
  serving_size_g: number | null;
  serving_size_desc: string | null;
  has_nutrition: boolean;
}

interface Props {
  locale: string;
  currentDate: string;
  mealType: string;
  logId: number | null;
  onAdded: (newLogId?: number) => void;
  onClose: () => void;
  onCreateCustom?: () => void;
}

type Mode = "camera" | "manual";
type Phase = "scanning" | "loading" | "found" | "notfound" | "added";

// ── Component ────────────────────────────────────────────────────────────────

export function BarcodeScannerModal({
  locale,
  currentDate,
  mealType,
  logId,
  onAdded,
  onClose,
  onCreateCustom,
}: Props) {
  const t = useTranslations("barcodeScanner");

  const [mode, setMode] = useState<Mode>("camera");
  const [phase, setPhase] = useState<Phase>("scanning");
  const [manualCode, setManualCode] = useState("");
  const [result, setResult] = useState<BarcodeResult | null>(null);
  const [quantity, setQuantity] = useState("100");
  const [addingToLog, setAddingToLog] = useState(false);
  const [savingToLibrary, setSavingToLibrary] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraSupported, setCameraSupported] = useState(true);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerControlsRef = useRef<{ stop: () => void } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check if camera barcode detection is possible
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasGetUserMedia = !!(navigator.mediaDevices?.getUserMedia);
    if (!hasGetUserMedia) {
      setCameraSupported(false);
      setMode("manual");
    }
  }, []);

  // Start camera scanning
  const startCamera = useCallback(async () => {
    if (!videoRef.current) return;
    setCameraError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      // Dynamic import of ZXing to avoid SSR issues
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();

      const controls = await reader.decodeFromVideoElement(
        videoRef.current,
        (result, error) => {
          if (result) {
            const code = result.getText();
            if (/^\d{8,14}$/.test(code)) {
              controls.stop();
              stopStream();
              handleBarcodeDetected(code, "camera");
            }
          }
        }
      );
      scannerControlsRef.current = controls;
    } catch (err: any) {
      if (err?.name === "NotAllowedError") {
        setCameraError(t("cameraPermissionDenied"));
      } else if (err?.name === "NotFoundError") {
        setCameraError(t("cameraNotFound"));
      } else {
        setCameraError(t("cameraError"));
      }
      setMode("manual");
    }
  }, [t]);

  const stopStream = useCallback(() => {
    if (scannerControlsRef.current) {
      try { scannerControlsRef.current.stop(); } catch {}
      scannerControlsRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (mode === "camera" && phase === "scanning") {
      startCamera();
    }
    return () => {
      if (mode === "camera") stopStream();
    };
  }, [mode, phase]);

  useEffect(() => {
    return () => stopStream();
  }, []);

  async function handleBarcodeDetected(code: string, source: "camera" | "manual") {
    setScannedBarcode(code);
    setPhase("loading");
    try {
      const res = await api.post("/api/v1/barcode/lookup", { barcode: code, source });
      const data: BarcodeResult = res.data;
      setResult(data);
      // Default quantity to serving size if available
      if (data.serving_size_g) {
        setQuantity(String(Math.round(data.serving_size_g)));
      } else {
        setQuantity("100");
      }
      setPhase(data.found ? "found" : "notfound");
    } catch {
      setResult(null);
      setPhase("notfound");
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    await handleBarcodeDetected(code, "manual");
  }

  function reset() {
    setPhase("scanning");
    setResult(null);
    setScannedBarcode(null);
    setManualCode("");
    setSuccessMsg(false);
  }

  async function ensureLog(): Promise<number> {
    if (logId) return logId;
    const res = await api.post("/api/v1/nutrition", { logged_date: currentDate });
    return res.data.id;
  }

  async function handleAddToLog() {
    if (!result || !result.has_nutrition) return;
    const qty = parseFloat(quantity) || 100;
    const factor = qty / 100;

    setAddingToLog(true);
    try {
      const lid = await ensureLog();
      await api.post(`/api/v1/nutrition/${lid}/foods`, {
        meal_type: mealType,
        food_name: result.brand ? `${result.food_name} (${result.brand})` : result.food_name,
        quantity_g: qty,
        calories: result.calories_per_100g != null ? Math.round(result.calories_per_100g * factor) : undefined,
        protein_g: result.protein_g_per_100g != null ? Math.round(result.protein_g_per_100g * factor * 10) / 10 : undefined,
        carbs_g: result.carbs_g_per_100g != null ? Math.round(result.carbs_g_per_100g * factor * 10) / 10 : undefined,
        fat_g: result.fat_g_per_100g != null ? Math.round(result.fat_g_per_100g * factor * 10) / 10 : undefined,
      });
      setSuccessMsg(true);
      onAdded(lid);
      setTimeout(() => setSuccessMsg(false), 1500);
    } finally {
      setAddingToLog(false);
    }
  }

  async function handleSaveToLibrary() {
    if (!result || !result.food_name) return;
    setSavingToLibrary(true);
    try {
      await api.post("/api/v1/foods", {
        name: result.food_name,
        brand: result.brand,
        calories_per_serving: result.calories_per_100g ?? 0,
        protein_g_per_serving: result.protein_g_per_100g ?? 0,
        carbs_g_per_serving: result.carbs_g_per_100g ?? 0,
        fat_g_per_serving: result.fat_g_per_100g ?? 0,
        serving_size_g: result.serving_size_g ?? 100,
      });
    } finally {
      setSavingToLibrary(false);
    }
  }

  const scaledCal = result?.calories_per_100g != null
    ? Math.round(result.calories_per_100g * (parseFloat(quantity) || 100) / 100)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-2 sm:p-4">
      <div className="relative w-full max-w-md bg-background rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b shrink-0">
          <Scan className="h-5 w-5 text-primary shrink-0" />
          <h2 className="font-semibold flex-1">{t("title")}</h2>
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium capitalize">{mealType}</span>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode tabs */}
        {phase === "scanning" && (
          <div className="flex gap-0.5 px-3 pt-2 pb-0 shrink-0">
            {cameraSupported && (
              <button
                onClick={() => { setMode("camera"); setCameraError(null); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t-lg border-b-2 transition-colors ${
                  mode === "camera" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Camera className="h-3.5 w-3.5" />{t("cameraTab")}
              </button>
            )}
            <button
              onClick={() => { setMode("manual"); stopStream(); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t-lg border-b-2 transition-colors ${
                mode === "manual" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Keyboard className="h-3.5 w-3.5" />{t("manualTab")}
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Scanning phase ── */}
          {phase === "scanning" && mode === "camera" && (
            <div className="p-4 space-y-3">
              {cameraError ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20 p-3 text-sm text-amber-700 dark:text-amber-300">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{cameraError}</span>
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                  />
                  {/* Scan guide overlay */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-56 h-28 border-2 border-white/70 rounded-lg relative">
                      {/* Corner markers */}
                      {[["top-0 left-0 border-t-2 border-l-2", ""], ["top-0 right-0 border-t-2 border-r-2", ""], ["bottom-0 left-0 border-b-2 border-l-2", ""], ["bottom-0 right-0 border-b-2 border-r-2", ""]].map(([cls], i) => (
                        <div key={i} className={`absolute w-4 h-4 border-primary ${cls} -m-px`} />
                      ))}
                      {/* Scan line animation */}
                      <div className="absolute inset-x-0 h-0.5 bg-primary/80 top-1/2 animate-[scanline_1.5s_ease-in-out_infinite]" />
                    </div>
                  </div>
                  <p className="absolute bottom-2 inset-x-0 text-center text-white/80 text-xs font-medium drop-shadow">{t("aimAtBarcode")}</p>
                </div>
              )}
            </div>
          )}

          {phase === "scanning" && mode === "manual" && (
            <div className="p-4">
              <form onSubmit={handleManualSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("enterBarcode")}</Label>
                  <div className="flex gap-2">
                    <Input
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value.replace(/\D/g, "").slice(0, 14))}
                      placeholder="8690504001546"
                      inputMode="numeric"
                      pattern="\d{8,14}"
                      required
                      autoFocus
                      className="font-mono tracking-widest"
                    />
                    <Button type="submit" disabled={manualCode.length < 8}>
                      <Scan className="h-4 w-4 mr-1.5" />
                      {t("lookup")}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{t("barcodeHint")}</p>
                </div>
              </form>
            </div>
          )}

          {/* ── Loading phase ── */}
          {phase === "loading" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">{t("looking")} {scannedBarcode}</p>
            </div>
          )}

          {/* ── Not found phase ── */}
          {phase === "notfound" && (
            <div className="p-4 space-y-4">
              <div className="flex flex-col items-center py-6 gap-3 text-center">
                <PackageSearch className="h-12 w-12 text-muted-foreground/30" />
                <div>
                  <p className="font-medium">{t("notFound")}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {scannedBarcode && <span className="font-mono">{scannedBarcode}</span>}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">{t("notFoundDesc")}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {onCreateCustom && (
                  <Button onClick={() => { onClose(); onCreateCustom(); }} className="w-full gap-2">
                    <Plus className="h-4 w-4" />{t("createCustomFood")}
                  </Button>
                )}
                <Button variant="outline" onClick={reset} className="w-full gap-2">
                  <RotateCcw className="h-4 w-4" />{t("scanAnother")}
                </Button>
              </div>
            </div>
          )}

          {/* ── Found phase ── */}
          {phase === "found" && result && (
            <div className="p-4 space-y-4">
              {/* Product card */}
              <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm leading-tight">{result.food_name}</p>
                    {result.brand && <p className="text-xs text-muted-foreground mt-0.5">{result.brand}</p>}
                    {scannedBarcode && <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{scannedBarcode}</p>}
                  </div>
                  <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full shrink-0">
                    {t("sourceLabel")}
                  </span>
                </div>

                {result.has_nutrition ? (
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: t("calories"), value: result.calories_per_100g, unit: "kcal", color: "text-orange-600 dark:text-orange-400" },
                      { label: t("protein"), value: result.protein_g_per_100g, unit: "g", color: "text-blue-600 dark:text-blue-400" },
                      { label: t("carbs"), value: result.carbs_g_per_100g, unit: "g", color: "text-amber-600 dark:text-amber-400" },
                      { label: t("fat"), value: result.fat_g_per_100g, unit: "g", color: "text-rose-600 dark:text-rose-400" },
                    ].map(({ label, value, unit, color }) => (
                      <div key={label} className="text-center rounded-lg border bg-background py-2 px-1">
                        <p className={`text-base font-bold ${color}`}>{value != null ? Math.round(value * 10) / 10 : "—"}</p>
                        <p className="text-[9px] text-muted-foreground leading-tight">{unit}</p>
                        <p className="text-[9px] text-muted-foreground leading-tight">{label}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 rounded-lg px-3 py-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {t("noNutritionData")}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">{t("per100g")}</p>
              </div>

              {/* Quantity + Add */}
              {result.has_nutrition && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">{t("quantity")} (g)</Label>
                      <Input
                        type="number"
                        step="1"
                        min="1"
                        max="5000"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    {result.serving_size_g && (
                      <div className="pt-5">
                        <button
                          onClick={() => setQuantity(String(Math.round(result.serving_size_g!)))}
                          className="text-[10px] text-primary hover:underline whitespace-nowrap"
                        >
                          {t("useServing")} ({Math.round(result.serving_size_g)}g)
                        </button>
                      </div>
                    )}
                  </div>
                  {scaledCal != null && (
                    <p className="text-xs text-muted-foreground">
                      {t("totalFor")} {quantity}g: <span className="font-semibold text-foreground">{scaledCal} kcal</span>
                    </p>
                  )}

                  {successMsg ? (
                    <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                      <CheckCircle2 className="h-4 w-4" />{t("addedToLog")}
                    </div>
                  ) : (
                    <Button
                      onClick={handleAddToLog}
                      disabled={addingToLog}
                      className="w-full"
                    >
                      {addingToLog ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                      {t("addToLog")}
                    </Button>
                  )}
                </div>
              )}

              {/* Secondary actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5 text-xs"
                  onClick={handleSaveToLibrary}
                  disabled={savingToLibrary || !result.food_name}
                >
                  {savingToLibrary ? <Loader2 className="h-3 w-3 animate-spin" /> : <Star className="h-3 w-3" />}
                  {t("saveToLibrary")}
                </Button>
                <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs" onClick={reset}>
                  <RotateCcw className="h-3 w-3" />{t("scanAnother")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scanline keyframe — injected via style tag */}
      <style jsx global>{`
        @keyframes scanline {
          0%, 100% { transform: translateY(-14px); opacity: 0.6; }
          50% { transform: translateY(14px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
