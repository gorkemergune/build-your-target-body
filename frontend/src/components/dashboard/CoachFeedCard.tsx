"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { Bot, X, ChevronRight, Loader2 } from "lucide-react";
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
  high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  low: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800",
};

const PRIORITY_BADGE: Record<string, string> = {
  high: "bg-red-500 text-white",
  medium: "bg-amber-500 text-white",
  low: "bg-blue-500 text-white",
};

export function CoachFeedCard({ locale }: { locale: string }) {
  const t = useTranslations("coach");
  const [insights, setInsights] = useState<Insight[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    // Load existing insights first (fast)
    api.get("/api/v1/coach/insights").then((r) => setInsights(r.data)).catch(() => {});

    // Fire-and-forget generate (may produce new ones; refresh after)
    setGenerating(true);
    api
      .post("/api/v1/coach/generate")
      .then(() => api.get("/api/v1/coach/insights"))
      .then((r) => setInsights(r.data))
      .catch(() => {})
      .finally(() => setGenerating(false));
  }, []);

  async function dismiss(id: number) {
    await api.patch(`/api/v1/coach/insights/${id}/dismiss`).catch(() => {});
    setInsights((prev) => prev.filter((ins) => ins.id !== id));
  }

  const visible = insights.slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4 text-primary" />
            {t("feedTitle")}
            {generating && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            )}
          </CardTitle>
          {insights.length > 0 && (
            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link href={`/${locale}/coach/insights`}>
                {t("viewAll")}
                <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
              </Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t("noInsights")}
          </p>
        ) : (
          <div className="space-y-3">
            {visible.map((ins) => (
              <div
                key={ins.id}
                className={cn(
                  "relative rounded-xl border p-4 transition-all",
                  PRIORITY_STYLES[ins.priority]
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide",
                        PRIORITY_BADGE[ins.priority]
                      )}
                    >
                      {t(ins.priority as any)}
                    </span>
                    <span className="text-xs font-medium opacity-70">
                      {t(`category_${ins.category}` as any)}
                    </span>
                  </div>
                  <button
                    onClick={() => dismiss(ins.id)}
                    className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
                    title={t("dismiss")}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-sm font-semibold leading-snug mb-1">{ins.title}</p>
                <p className="text-xs leading-relaxed opacity-80">{ins.content}</p>
              </div>
            ))}
            {insights.length > 3 && (
              <Button asChild variant="outline" size="sm" className="w-full text-xs">
                <Link href={`/${locale}/coach/insights`}>
                  {t("viewAll")} ({insights.length})
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Link>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
