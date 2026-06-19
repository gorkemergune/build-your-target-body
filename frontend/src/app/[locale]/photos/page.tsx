"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import {
  Camera,
  Trash2,
  X,
  SplitSquareHorizontal,
  Upload,
  Loader2,
  ImageOff,
} from "lucide-react";

interface ProgressPhoto {
  id: number;
  image_path: string;
  uploaded_at: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  note: string | null;
}

export default function PhotosPage({ params: { locale } }: { params: { locale: string } }) {
  const t = useTranslations("photos");
  const tC = useTranslations("common");

  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageUrls, setImageUrls] = useState<Record<number, string>>({});
  const loadingIds = useRef<Set<number>>(new Set());
  const createdUrls = useRef<string[]>([]);

  // Upload form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [weightKg, setWeightKg] = useState("");
  const [bodyFatPct, setBodyFatPct] = useState("");
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compare mode
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);

  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    api
      .get("/api/v1/photos")
      .then((r) => setPhotos(r.data))
      .catch(() => setPhotos([]))
      .finally(() => setLoading(false));
  }, []);

  // Load image blobs progressively as photos list changes
  useEffect(() => {
    photos.forEach(async (photo) => {
      if (!imageUrls[photo.id] && !loadingIds.current.has(photo.id)) {
        loadingIds.current.add(photo.id);
        try {
          const r = await api.get(`/api/v1/photos/${photo.id}/image`, { responseType: "blob" });
          const url = URL.createObjectURL(r.data);
          createdUrls.current.push(url);
          setImageUrls((prev) => ({ ...prev, [photo.id]: url }));
        } catch {
          // silently skip
        } finally {
          loadingIds.current.delete(photo.id);
        }
      }
    });
  }, [photos]);

  useEffect(() => {
    const urls = createdUrls.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("photo", selectedFile);
      if (weightKg) fd.append("weight_kg", weightKg);
      if (bodyFatPct) fd.append("body_fat_pct", bodyFatPct);
      if (note) fd.append("note", note);
      const r = await api.post("/api/v1/photos", fd);
      const newPhoto: ProgressPhoto = r.data;
      setPhotos((prev) => [newPhoto, ...prev]);
      // Reset form
      setSelectedFile(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      setWeightKg("");
      setBodyFatPct("");
      setNote("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e: any) {
      alert(e?.response?.data?.detail || t("uploadError"));
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      await api.delete(`/api/v1/photos/${id}`);
      setPhotos((prev) => prev.filter((p) => p.id !== id));
      if (imageUrls[id]) {
        URL.revokeObjectURL(imageUrls[id]);
        setImageUrls((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
      setSelected((prev) => prev.filter((x) => x !== id));
    } catch {
      alert(t("deleteError"));
    } finally {
      setDeletingId(null);
    }
  }

  function handlePhotoSelect(id: number) {
    if (!compareMode) return;
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length < 2) return [...prev, id];
      return [prev[1], id];
    });
  }

  const photoA = photos.find((p) => p.id === selected[0]);
  const photoB = photos.find((p) => p.id === selected[1]);

  const daysBetween =
    photoA && photoB
      ? Math.round(
          Math.abs(
            new Date(photoB.uploaded_at).getTime() -
              new Date(photoA.uploaded_at).getTime()
          ) /
            (1000 * 60 * 60 * 24)
        )
      : null;

  const weightDiff =
    photoA?.weight_kg != null && photoB?.weight_kg != null
      ? photoB.weight_kg - photoA.weight_kg
      : null;

  const fatDiff =
    photoA?.body_fat_pct != null && photoB?.body_fat_pct != null
      ? photoB.body_fat_pct - photoA.body_fat_pct
      : null;

  const fmt = (dt: string) =>
    new Date(dt).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const photosByMonth = photos.reduce(
    (acc, photo) => {
      const d = new Date(photo.uploaded_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString(locale === "tr" ? "tr-TR" : "en-US", {
        year: "numeric",
        month: "long",
      });
      if (!acc[key]) acc[key] = { label, items: [] };
      acc[key].items.push(photo);
      return acc;
    },
    {} as Record<string, { label: string; items: typeof photos }>
  );
  const monthKeys = Object.keys(photosByMonth).sort((a, b) => b.localeCompare(a));

  return (
    <AppLayout locale={locale}>
      <div className="space-y-6 max-w-4xl">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Camera className="h-8 w-8 text-primary" />
          {t("title")}
        </h1>

        {/* ── Upload Section ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4" />
              {t("upload")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {preview ? (
                <img
                  src={preview}
                  alt="preview"
                  className="max-h-56 mx-auto rounded-lg object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Camera className="h-10 w-10 opacity-40" />
                  <p className="text-sm font-medium">{t("dragDrop")}</p>
                  <p className="text-xs opacity-70">{t("supportedFormats")}</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  {t("weightAtTime")}
                </label>
                <Input
                  type="number"
                  min="20"
                  max="500"
                  step="0.1"
                  placeholder="75.5"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  {t("bodyFatAtTime")}
                </label>
                <Input
                  type="number"
                  min="1"
                  max="70"
                  step="0.1"
                  placeholder="18.5"
                  value={bodyFatPct}
                  onChange={(e) => setBodyFatPct(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                {t("note")}
              </label>
              <textarea
                placeholder={t("note")}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={500}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>

            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="w-full"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("uploading")}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {t("uploadBtn")}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* ── Compare toggle + count ── */}
        {photos.length > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {photos.length}{" "}
              {locale === "tr"
                ? "fotoğraf"
                : photos.length === 1
                ? "photo"
                : "photos"}
            </p>
            <Button
              variant={compareMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setCompareMode((p) => !p);
                setSelected([]);
              }}
            >
              <SplitSquareHorizontal className="h-4 w-4 mr-2" />
              {compareMode ? t("compareExit") : t("compareMode")}
            </Button>
          </div>
        )}

        {/* ── Compare instructions ── */}
        {compareMode && selected.length < 2 && (
          <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground text-center">
            {selected.length === 0 ? t("selectPhotoA") : t("selectPhotoB")}
          </div>
        )}

        {/* ── Comparison Panel ── */}
        {compareMode && selected.length === 2 && photoA && photoB && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{t("compareTitle")}</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setSelected([])}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                {([{ photo: photoA, label: "A", ring: "bg-blue-500" }, { photo: photoB, label: "B", ring: "bg-green-500" }] as const).map(({ photo, label, ring }) => (
                  <div key={photo.id}>
                    <div className="aspect-[3/4] overflow-hidden rounded-lg bg-muted mb-3">
                      {imageUrls[photo.id] ? (
                        <img
                          src={imageUrls[photo.id]}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full text-white ${ring}`}>
                        {label}
                      </span>
                      <p className="text-sm font-medium">{fmt(photo.uploaded_at)}</p>
                      {photo.weight_kg != null && (
                        <p className="text-xs text-muted-foreground">{photo.weight_kg} kg</p>
                      )}
                      {photo.body_fat_pct != null && (
                        <p className="text-xs text-muted-foreground">{photo.body_fat_pct}%</p>
                      )}
                      {photo.note && (
                        <p className="text-xs text-muted-foreground italic">{photo.note}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Diff stats */}
              <div className="border-t pt-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-muted/60 px-3 py-3 text-center">
                    <p className="text-2xl font-bold">{daysBetween ?? "—"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("daysBetween")}</p>
                  </div>
                  <div className="rounded-lg bg-muted/60 px-3 py-3 text-center">
                    {weightDiff != null ? (
                      <>
                        <p className={`text-2xl font-bold ${weightDiff < 0 ? "text-green-600" : weightDiff > 0 ? "text-red-500" : ""}`}>
                          {weightDiff > 0 ? "+" : ""}{weightDiff.toFixed(1)} kg
                        </p>
                      </>
                    ) : (
                      <p className="text-2xl font-bold text-muted-foreground">—</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">{t("weightChange")}</p>
                  </div>
                  <div className="rounded-lg bg-muted/60 px-3 py-3 text-center">
                    {fatDiff != null ? (
                      <>
                        <p className={`text-2xl font-bold ${fatDiff < 0 ? "text-green-600" : fatDiff > 0 ? "text-red-500" : ""}`}>
                          {fatDiff > 0 ? "+" : ""}{fatDiff.toFixed(1)}%
                        </p>
                      </>
                    ) : (
                      <p className="text-2xl font-bold text-muted-foreground">—</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">{t("fatChange")}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Gallery ── */}
        {loading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {tC("loading")}
          </div>
        ) : photos.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <ImageOff className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="font-semibold text-muted-foreground">{t("emptyTitle")}</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                {t("emptyDescription")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {monthKeys.map((monthKey) => {
              const { label, items } = photosByMonth[monthKey];
              return (
                <div key={monthKey}>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                    <span className="h-px flex-1 bg-border" />
                    {label}
                    <span className="text-xs font-normal normal-case">({items.length})</span>
                    <span className="h-px flex-1 bg-border" />
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {items.map((photo) => {
                      const isA = selected[0] === photo.id;
                      const isB = selected[1] === photo.id;
                      const isSelected = isA || isB;

                      return (
                        <div
                          key={photo.id}
                          className={`group relative rounded-xl overflow-hidden border transition-all hover:shadow-md ${
                            compareMode ? "cursor-pointer" : ""
                          } ${
                            isA
                              ? "ring-2 ring-blue-500 ring-offset-1"
                              : isB
                              ? "ring-2 ring-green-500 ring-offset-1"
                              : compareMode
                              ? "hover:ring-2 hover:ring-primary/40 hover:ring-offset-1"
                              : ""
                          }`}
                          onClick={() => handlePhotoSelect(photo.id)}
                        >
                          {/* Thumbnail */}
                          <div className="aspect-square overflow-hidden bg-muted">
                            {imageUrls[photo.id] ? (
                              <img
                                src={imageUrls[photo.id]}
                                alt=""
                                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center animate-pulse">
                                <Camera className="h-8 w-8 text-muted-foreground/20" />
                              </div>
                            )}
                          </div>

                          {/* Compare badges */}
                          {compareMode && isSelected && (
                            <div className="absolute top-2 left-2">
                              <span
                                className={`text-xs font-bold px-2 py-0.5 rounded-full text-white shadow ${
                                  isA ? "bg-blue-500" : "bg-green-500"
                                }`}
                              >
                                {isA ? "A" : "B"}
                              </span>
                            </div>
                          )}

                          {/* Delete button */}
                          {!compareMode && (
                            <button
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-full p-1.5"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(tC("deleteConfirm"))) handleDelete(photo.id);
                              }}
                              disabled={deletingId === photo.id}
                            >
                              {deletingId === photo.id ? (
                                <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5 text-white" />
                              )}
                            </button>
                          )}

                          {/* Metadata */}
                          <div className="p-2.5">
                            <p className="text-xs text-muted-foreground">{fmt(photo.uploaded_at)}</p>
                            <div className="flex gap-2 mt-0.5 flex-wrap">
                              {photo.weight_kg != null && (
                                <span className="text-xs font-medium">{photo.weight_kg} kg</span>
                              )}
                              {photo.body_fat_pct != null && (
                                <span className="text-xs font-medium">{photo.body_fat_pct}%</span>
                              )}
                            </div>
                            {photo.note && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">{photo.note}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
