"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { MessageSquarePlus, CheckCircle2, Bug, Lightbulb, MessageSquare, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

type FeedbackType = "bug" | "feature_request" | "general_feedback";

interface FeedbackItem {
  id: number;
  type: FeedbackType;
  message: string;
  created_at: string;
}

const TYPE_META: Record<FeedbackType, { icon: React.ElementType; color: string }> = {
  bug: { icon: Bug, color: "text-destructive" },
  feature_request: { icon: Lightbulb, color: "text-amber-500" },
  general_feedback: { icon: MessageSquare, color: "text-primary" },
};

export default function FeedbackPage({ params: { locale } }: { params: { locale: string } }) {
  const t = useTranslations("feedback");
  const td = useTranslations("demo");

  const [type, setType] = useState<FeedbackType>("general_feedback");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState<FeedbackItem[]>([]);

  const [demoLoading, setDemoLoading] = useState(false);
  const [demoMsg, setDemoMsg] = useState("");

  const fetchMy = () =>
    api.get("/api/v1/feedback/my").then((r) => setItems(r.data)).catch(() => {});

  useEffect(() => {
    fetchMy();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 10) return;
    setSubmitting(true);
    setError("");
    try {
      await api.post("/api/v1/feedback", { type, message: message.trim() });
      setSubmitted(true);
      setMessage("");
      fetchMy();
    } catch {
      setError(t("submitError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGenerateDemo() {
    if (!confirm(td("confirmMsg"))) return;
    setDemoLoading(true);
    setDemoMsg("");
    try {
      await api.post("/api/v1/demo/generate");
      setDemoMsg(td("success"));
    } catch {
      setDemoMsg(td("error"));
    } finally {
      setDemoLoading(false);
    }
  }

  const TYPES: { value: FeedbackType; labelKey: string }[] = [
    { value: "bug", labelKey: "bug" },
    { value: "feature_request", labelKey: "feature_request" },
    { value: "general_feedback", labelKey: "general_feedback" },
  ];

  return (
    <AppLayout locale={locale}>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <MessageSquarePlus className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold">{t("title")}</h1>
        </div>

        {/* Submit form */}
        <Card>
          <CardHeader>
            <CardTitle>{t("submitTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
                <p className="font-medium">{t("submitSuccess")}</p>
                <Button variant="outline" size="sm" onClick={() => setSubmitted(false)}>
                  {t("submitAnother")}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("type")}</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {TYPES.map(({ value, labelKey }) => {
                      const meta = TYPE_META[value];
                      const Icon = meta.icon;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setType(value)}
                          className={cn(
                            "flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-xs font-medium transition-colors",
                            type === value
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                          )}
                        >
                          <Icon className={cn("h-5 w-5", type === value ? "text-primary" : meta.color)} />
                          {t(labelKey as any)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t("message")}</Label>
                  <textarea
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none min-h-[120px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder={t("messagePlaceholder")}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    minLength={10}
                    maxLength={2000}
                  />
                  <p className="text-xs text-muted-foreground text-right">{message.length} / 2000</p>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button type="submit" disabled={submitting || message.trim().length < 10} className="w-full">
                  {submitting ? t("submitting") : t("submit")}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* My submissions */}
        {items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("myFeedback")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {items.map((item) => {
                  const meta = TYPE_META[item.type as FeedbackType] ?? TYPE_META.general_feedback;
                  const Icon = meta.icon;
                  return (
                    <div key={item.id} className="py-3 flex gap-3">
                      <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", meta.color)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium capitalize text-muted-foreground">
                            {t(item.type as any)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(item.created_at).toLocaleDateString(
                              locale === "tr" ? "tr-TR" : "en-US",
                              { year: "numeric", month: "short", day: "numeric" }
                            )}
                          </span>
                        </div>
                        <p className="text-sm">{item.message}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Demo data */}
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              {td("title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{td("description")}</p>
            {demoMsg && (
              <p className="text-sm font-medium text-green-600">{demoMsg}</p>
            )}
            <Button
              variant="outline"
              onClick={handleGenerateDemo}
              disabled={demoLoading}
              className="w-full sm:w-auto"
            >
              <Zap className="h-4 w-4 mr-2" />
              {demoLoading ? td("generating") : td("generateBtn")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
