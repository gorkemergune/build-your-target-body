"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { Bot, Send } from "lucide-react";

const TYPES = ["nutrition", "workout", "goal_analysis", "progress"] as const;
type ConvType = typeof TYPES[number];

export default function AiCoachPage({ params: { locale } }: { params: { locale: string } }) {
  const t = useTranslations("ai");
  const [convType, setConvType] = useState<ConvType>("nutrition");
  const [prompt, setPrompt] = useState("");
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchConversations = () => api.get("/api/v1/ai/conversations").then((r) => setConversations(r.data));
  useEffect(() => { fetchConversations(); }, []);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      await api.post("/api/v1/ai/coach", { conversation_type: convType, prompt });
      setPrompt("");
      fetchConversations();
    } finally { setLoading(false); }
  }

  const typeLabel: Record<ConvType, string> = {
    nutrition: t("nutrition"),
    workout: t("workout"),
    goal_analysis: t("goalAnalysis"),
    progress: t("progress"),
  };

  return (
    <AppLayout locale={locale}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Bot className="h-8 w-8 text-primary" />{t("title")}
        </h1>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex gap-2 flex-wrap">
              {TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setConvType(type)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${convType === type ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
                >
                  {typeLabel[type]}
                </button>
              ))}
            </div>
            <form onSubmit={handleSend} className="flex gap-3">
              <textarea
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none min-h-[80px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder={t("placeholder")}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <Button type="submit" disabled={loading || !prompt.trim()} className="self-end">
                {loading ? t("thinking") : <><Send className="h-4 w-4 mr-1" />{t("send")}</>}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t("conversations")}</h2>
          {conversations.map((c) => (
            <Card key={c.id}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 capitalize">
                    {typeLabel[c.conversation_type as ConvType]}
                  </span>
                  <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</span>
                </div>
                <div className="rounded-md bg-muted px-4 py-3 text-sm">
                  <p className="font-medium mb-1">You:</p>
                  <p className="text-muted-foreground">{c.prompt}</p>
                </div>
                <div className="rounded-md bg-primary/5 border border-primary/20 px-4 py-3 text-sm">
                  <p className="font-medium mb-1 flex items-center gap-1"><Bot className="h-3.5 w-3.5" /> AI Coach:</p>
                  <p className="whitespace-pre-wrap leading-relaxed">{c.response}</p>
                </div>
              </CardContent>
            </Card>
          ))}
          {!conversations.length && (
            <p className="text-center text-muted-foreground py-8">Ask your AI coach anything to get started</p>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
