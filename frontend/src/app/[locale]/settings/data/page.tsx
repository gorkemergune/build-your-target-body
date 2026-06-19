"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import {
  Download,
  FileJson,
  FileSpreadsheet,
  Package,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";

interface ImportResult {
  imported: {
    weight_logs: number;
    body_fat_logs: number;
    measurements: number;
    nutrition_logs: number;
    workouts: number;
    skipped: number;
  };
  total_imported: number;
}

async function triggerDownload(url: string, filename: string) {
  const r = await api.get(url, { responseType: "blob" });
  const href = URL.createObjectURL(r.data);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 2000);
}

export default function DataManagementPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const t = useTranslations("settings");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [downloadingJson, setDownloadingJson] = useState(false);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleExportJson() {
    setDownloadingJson(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await triggerDownload("/api/v1/export/json", `bytb_export_${today}.json`);
    } finally {
      setDownloadingJson(false);
    }
  }

  async function handleExportCsv() {
    setDownloadingCsv(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await triggerDownload("/api/v1/export/csv", `bytb_csv_${today}.zip`);
    } finally {
      setDownloadingCsv(false);
    }
  }

  async function handleExportBackup() {
    setDownloadingBackup(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await triggerDownload("/api/v1/export/full-backup", `bytb_backup_${today}.zip`);
    } finally {
      setDownloadingBackup(false);
    }
  }

  async function handleImport(file: File) {
    if (!file.name.endsWith(".json")) {
      setImportError(t("wrongFileType"));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setImportError(t("fileTooLarge"));
      return;
    }
    setImporting(true);
    setImportResult(null);
    setImportError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.post("/api/v1/import/json", fd);
      setImportResult(r.data);
    } catch (err: any) {
      setImportError(err?.response?.data?.detail || t("importError"));
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleImport(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleImport(file);
  }

  return (
    <AppLayout locale={locale}>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-3xl font-bold">{t("dataTitle")}</h1>
          <p className="text-muted-foreground mt-1">{t("dataSubtitle")}</p>
        </div>

        {/* ── Export Section ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Download className="h-4 w-4 text-primary" />
              {t("exportSection")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* JSON Export */}
            <div className="flex items-start justify-between gap-4 rounded-lg border p-4 hover:bg-accent/30 transition-colors">
              <div className="flex items-start gap-3 min-w-0">
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-2 shrink-0">
                  <FileJson className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <p className="font-medium text-sm">{t("exportJson")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("exportJsonDesc")}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportJson}
                disabled={downloadingJson}
                className="shrink-0"
              >
                {downloadingJson ? t("downloading") : <Download className="h-4 w-4" />}
              </Button>
            </div>

            {/* CSV Export */}
            <div className="flex items-start justify-between gap-4 rounded-lg border p-4 hover:bg-accent/30 transition-colors">
              <div className="flex items-start gap-3 min-w-0">
                <div className="rounded-lg bg-green-50 dark:bg-green-950/30 p-2 shrink-0">
                  <FileSpreadsheet className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <p className="font-medium text-sm">{t("exportCsv")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("exportCsvDesc")}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportCsv}
                disabled={downloadingCsv}
                className="shrink-0"
              >
                {downloadingCsv ? t("downloading") : <Download className="h-4 w-4" />}
              </Button>
            </div>

            {/* Full Backup */}
            <div className="flex items-start justify-between gap-4 rounded-lg border p-4 hover:bg-accent/30 transition-colors">
              <div className="flex items-start gap-3 min-w-0">
                <div className="rounded-lg bg-purple-50 dark:bg-purple-950/30 p-2 shrink-0">
                  <Package className="h-4 w-4 text-purple-500" />
                </div>
                <div>
                  <p className="font-medium text-sm">{t("exportFullBackup")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("exportFullBackupDesc")}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportBackup}
                disabled={downloadingBackup}
                className="shrink-0"
              >
                {downloadingBackup ? t("downloading") : <Download className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Import Section ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-4 w-4 text-primary" />
              {t("importSection")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("importDesc")}</p>

            {/* Dropzone */}
            <div
              className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/20"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <FileJson className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                {dragOver ? t("dropzoneActive") : t("dropzone")}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>

            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="w-full"
              variant="outline"
            >
              {importing ? (
                <>
                  <Upload className="h-4 w-4 mr-2 animate-bounce" />
                  {t("importing")}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {t("importBtn")}
                </>
              )}
            </Button>

            {/* Import result */}
            {importResult && (
              <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 px-4 py-3 space-y-1.5">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <p className="text-sm font-semibold">
                    {t("importSuccess", { total: importResult.total_imported })}
                  </p>
                </div>
                <p className="text-xs text-green-600 dark:text-green-400">
                  {t("importDetails", {
                    weight: importResult.imported.weight_logs,
                    fat: importResult.imported.body_fat_logs,
                    meas: importResult.imported.measurements,
                    nutrition: importResult.imported.nutrition_logs,
                    workouts: importResult.imported.workouts,
                    skipped: importResult.imported.skipped,
                  })}
                </p>
              </div>
            )}

            {importError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                {importError}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Danger Zone note ── */}
        <Card className="border-orange-200 dark:border-orange-800">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">
                  {t("dangerZone")}
                </p>
                <p className="text-xs text-orange-600 dark:text-orange-500 mt-0.5">
                  {t("dangerDesc")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
