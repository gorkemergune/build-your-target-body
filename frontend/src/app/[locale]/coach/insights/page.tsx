"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { Bot, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Insight {
  id: number;
  category: string;
  priority: "high" | "medium" | "low";
  title: string;
  content: string;
  trigger_key: string;
  dismissed: boolean;
  created_at: string;
}

const PRIORITY_STYLES: Record<string, string> = {
  high: "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/10",
  medium: "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/10",
  low: "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/10",
};

const PRIORITY_BADGE: Record<string, string> = {
  high: "bg-red-500 text-white",
  medium: "bg-amber-500 text-white",
  low: "bg-blue-500 text-white",
};

export default function CoachInsightsPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const t = useTranslations("coach");
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDismissed, setShowDismissed] = useState(false);
  const [generating, setGenerating] = useState(false);

  function load(withDismissed: boolean) {
    setLoading(true);
    api
      .get(`/api/v1/coach/insights?include_dismissed=${withDismissed}`)
      .then((r) => setInsights(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(showDismissed);
  }, [showDismissed]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      await api.post("/api/v1/coach/generate");
      load(showDismissed);
    } finally {
      setGenerating(false);
    }
  }

  async function dismiss(id: number) {
    await api.patch(`/api/v1/coach/insights/${id}/dismiss`).catch(() => {});
    setInsights((prev) =>
      showDismissed
        ? prev.map((ins) => (ins.id === id ? { ...ins, dismissed: true } : ins))
        : prev.filter((ins) => ins.id !== id)
    );
  }

  const fmt = (dt: string) =>
    new Date(dt).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  return (
    <AppLayout locale={locale}>
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Bot className="h-7 w-7 text-primary" />
              {t("historyTitle")}
            </h1>
            <p className="text-muted-foreground mt-1">{t("historySubtitle")}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDismissed((p) => !p)}
            >
              {showDismissed ? t("hideDismissed") : t("showDismissed")}
            </Button>
            <Button size="sm" onClick={handleGenerate} disabled={generating}>
              {generating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  {t("generating")}
                </>
              ) : (
                <>
                  <Bot className="h-3.5 w-3.5 mr-1.5" />
                  {locale === "tr" ? "Güncelle" : "Refresh"}
                </>
              )}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {locale === "tr" ? "Yükleniyor..." : "Loading..."}
          </div>
        ) : insights.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Bot className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="font-semibold text-muted-foreground">{t("noHistory")}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {locale === "tr"
                  ? "Daha fazla veri girdikçe koçunuz içgörüler üretecek."
                  : "As you log more data, your coach will generate insights."}
              </p>
              <Button className="mt-4" size="sm" onClick={handleGenerate} disabled={generating}>
                {generating ? t("generating") : locale === "tr" ? "Şimdi Oluştur" : "Generate Now"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {insights.map((ins) => (
              <div
                key={ins.id}
                className={cn(
                  "relative rounded-xl border p-4 transition-all",
                  ins.dismissed ? "opacity-50" : PRIORITY_STYLES[ins.priority]
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide",
                        ins.dismissed ? "bg-muted text-muted-foreground" : PRIORITY_BADGE[ins.priority]
                      )}
                    >
                      {ins.dismissed ? t("dismissed") : t(ins.priority as any)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t(`category_${ins.category}` as any)}
                    </span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{fmt(ins.created_at)}</span>
                  </div>
                  {!ins.dismissed && (
                    <button
                      onClick={() => dismiss(ins.id)}
                      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                      title={t("dismiss")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <p className="text-sm font-semibold leading-snug mb-1.5">{ins.title}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{ins.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
