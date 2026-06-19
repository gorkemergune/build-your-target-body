"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import {
  FileText,
  Download,
  ChevronDown,
  ChevronUp,
  Loader2,
  Calendar,
  TrendingUp,
} from "lucide-react";

interface ReportSummary {
  id: number;
  type: string;
  title: string;
  generated_at: string;
}

interface ReportDetail extends ReportSummary {
  content: string;
}

function renderMarkdown(text: string) {
  return text.split("\n").map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={i} className="h-2" />;

    if (trimmed.startsWith("## ")) {
      return (
        <h2 key={i} className="text-base font-bold mt-5 mb-2 text-primary border-b pb-1">
          {trimmed.slice(3)}
        </h2>
      );
    }
    if (trimmed.startsWith("### ")) {
      return (
        <h3 key={i} className="text-sm font-semibold mt-3 mb-1">
          {trimmed.slice(4)}
        </h3>
      );
    }
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("• ")) {
      const content = trimmed.slice(2);
      return (
        <div key={i} className="flex gap-2 text-sm leading-relaxed pl-2">
          <span className="text-muted-foreground shrink-0 mt-0.5">•</span>
          <span dangerouslySetInnerHTML={{ __html: boldify(content) }} />
        </div>
      );
    }
    return (
      <p
        key={i}
        className="text-sm leading-relaxed"
        dangerouslySetInnerHTML={{ __html: boldify(trimmed) }}
      />
    );
  });
}

function boldify(text: string) {
  return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

export default function ReportsPage({ params: { locale } }: { params: { locale: string } }) {
  const t = useTranslations("reports");
  const [activeTab, setActiveTab] = useState<"weekly" | "monthly">("weekly");
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailCache, setDetailCache] = useState<Record<number, ReportDetail>>({});
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<number | null>(null);
  const [listLoading, setListLoading] = useState(true);

  const fetchReports = (type: "weekly" | "monthly") => {
    setListLoading(true);
    api
      .get(`/api/v1/reports?type=${type}`)
      .then((r) => setReports(r.data))
      .catch(() => setReports([]))
      .finally(() => setListLoading(false));
  };

  useEffect(() => {
    fetchReports(activeTab);
    setExpandedId(null);
  }, [activeTab]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const endpoint =
        activeTab === "weekly"
          ? "/api/v1/reports/generate-weekly"
          : "/api/v1/reports/generate-monthly";
      const r = await api.post(endpoint);
      // Add to list + immediately expand
      const newReport: ReportDetail = r.data;
      setReports((prev) => [newReport, ...prev]);
      setDetailCache((prev) => ({ ...prev, [newReport.id]: newReport }));
      setExpandedId(newReport.id);
    } catch (e: any) {
      alert(e?.response?.data?.detail || t("generateError"));
    } finally {
      setGenerating(false);
    }
  }

  async function toggleExpand(id: number) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!detailCache[id]) {
      setLoadingDetail(id);
      try {
        const r = await api.get(`/api/v1/reports/${id}`);
        setDetailCache((prev) => ({ ...prev, [id]: r.data }));
      } catch {
        // silently fail
      } finally {
        setLoadingDetail(null);
      }
    }
  }

  async function downloadPdf(id: number, title: string) {
    setDownloading(id);
    try {
      const r = await api.get(`/api/v1/reports/${id}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([r.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 60)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert(t("pdfError"));
    } finally {
      setDownloading(null);
    }
  }

  const typeIcon = activeTab === "weekly" ? (
    <Calendar className="h-4 w-4" />
  ) : (
    <TrendingUp className="h-4 w-4" />
  );

  return (
    <AppLayout locale={locale}>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="h-8 w-8 text-primary" />
            {t("title")}
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          {(["weekly", "monthly"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(tab)}
            </button>
          ))}
        </div>

        {/* Generate button */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {reports.length > 0
              ? t("reportCount", { count: reports.length })
              : t("noReports")}
          </p>
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("generating")}
              </>
            ) : (
              <>
                {typeIcon}
                <span className="ml-2">
                  {activeTab === "weekly" ? t("generateWeekly") : t("generateMonthly")}
                </span>
              </>
            )}
          </Button>
        </div>

        {/* Report list */}
        {listLoading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {t("loading")}
          </div>
        ) : reports.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">{t("emptyState")}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => {
              const isExpanded = expandedId === report.id;
              const detail = detailCache[report.id];
              const isLoadingDetail = loadingDetail === report.id;

              return (
                <Card key={report.id} className={isExpanded ? "ring-1 ring-primary/30" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base leading-snug">{report.title}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(report.generated_at).toLocaleString(
                            locale === "tr" ? "tr-TR" : "en-US"
                          )}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadPdf(report.id, report.title)}
                          disabled={downloading === report.id}
                        >
                          {downloading === report.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                          <span className="ml-1.5 hidden sm:inline">{t("exportPdf")}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpand(report.id)}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="pt-0">
                      <div className="border-t pt-4 mt-2">
                        {isLoadingDetail ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {t("loading")}
                          </div>
                        ) : detail ? (
                          <div className="space-y-1">{renderMarkdown(detail.content)}</div>
                        ) : (
                          <p className="text-sm text-muted-foreground">{t("loadError")}</p>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
