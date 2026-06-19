"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { Bot, Send, Trash2, RefreshCw, User } from "lucide-react";

interface ChatMessage {
  id?: number;
  role: "user" | "ai";
  content: string;
  timestamp: string;
  error?: boolean;
  retryContent?: string;
}

const SUGGESTED_KEYS = [
  "q_thisWeek",
  "q_onTrack",
  "q_improve",
  "q_plateau",
  "q_nextWeek",
  "q_protein",
  "q_workouts",
] as const;

export default function AiCoachPage({ params: { locale } }: { params: { locale: string } }) {
  const t = useTranslations("ai");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load conversation history on mount
  useEffect(() => {
    api
      .get("/api/v1/ai/conversations?type=chat")
      .then((r) => {
        const msgs: ChatMessage[] = [];
        for (const c of r.data) {
          msgs.push({
            id: c.id,
            role: "user",
            content: c.prompt,
            timestamp: c.created_at,
          });
          msgs.push({
            id: c.id,
            role: "ai",
            content: c.response,
            timestamp: c.created_at,
          });
        }
        setMessages(msgs);
      })
      .catch(() => {})
      .finally(() => setInitLoading(false));
  }, []);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setInputText("");

    // Optimistic user bubble
    const userMsg: ChatMessage = {
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const r = await api.post("/api/v1/ai/chat", { message: trimmed });
      const aiMsg: ChatMessage = {
        id: r.data.id,
        role: "ai",
        content: r.data.response,
        timestamp: r.data.created_at,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        role: "ai",
        content: t("errorMsg"),
        timestamp: new Date().toISOString(),
        error: true,
        retryContent: trimmed,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await sendMessage(inputText);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputText);
    }
  }

  async function handleClear() {
    if (!confirm(t("clearConfirm"))) return;
    await api.delete("/api/v1/ai/conversations").catch(() => {});
    setMessages([]);
  }

  function handleRetry(retryContent: string) {
    // Remove the error message, then resend
    setMessages((prev) => prev.slice(0, -1));
    sendMessage(retryContent);
  }

  function handleSuggestion(key: (typeof SUGGESTED_KEYS)[number]) {
    const text = t(key);
    setInputText(text);
    textareaRef.current?.focus();
  }

  return (
    <AppLayout locale={locale}>
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bot className="h-8 w-8 text-primary" />
            {t("title")}
          </h1>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClear} className="text-muted-foreground">
              <Trash2 className="h-4 w-4 mr-1.5" />
              {t("clearConversation")}
            </Button>
          )}
        </div>

        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>

        {/* Messages */}
        <Card>
          <CardContent className="p-4">
            <div className="min-h-[200px] max-h-[45svh] md:max-h-[55vh] overflow-y-auto space-y-4 pr-1">
              {initLoading ? (
                <div className="flex justify-center items-center h-40 text-muted-foreground text-sm">
                  {t("loading")}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                  <Bot className="h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground text-center">{t("emptyState")}</p>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                  >
                    {/* Avatar */}
                    <div
                      className={`shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium mt-0.5 ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted border"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <User className="h-3.5 w-3.5" />
                      ) : (
                        <Bot className="h-3.5 w-3.5" />
                      )}
                    </div>

                    {/* Bubble */}
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : msg.error
                          ? "bg-destructive/10 border border-destructive/30 text-destructive rounded-tl-sm"
                          : "bg-muted rounded-tl-sm"
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      {msg.error && msg.retryContent && (
                        <button
                          onClick={() => handleRetry(msg.retryContent!)}
                          className="mt-2 flex items-center gap-1 text-xs font-medium text-destructive hover:underline"
                        >
                          <RefreshCw className="h-3 w-3" />
                          {t("retry")}
                        </button>
                      )}
                      <p
                        className={`text-[10px] mt-1.5 ${
                          msg.role === "user" ? "text-primary-foreground/60" : "text-muted-foreground"
                        }`}
                      >
                        {new Date(msg.timestamp).toLocaleTimeString(
                          locale === "tr" ? "tr-TR" : "en-US",
                          { hour: "2-digit", minute: "2-digit" }
                        )}
                      </p>
                    </div>
                  </div>
                ))
              )}

              {/* Thinking indicator */}
              {loading && (
                <div className="flex gap-2.5">
                  <div className="shrink-0 h-7 w-7 rounded-full bg-muted border flex items-center justify-center mt-0.5">
                    <Bot className="h-3.5 w-3.5" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1 items-center">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </CardContent>
        </Card>

        {/* Suggested questions */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {t("suggestedQuestions")}
          </p>
          <div className="flex gap-2 flex-wrap">
            {SUGGESTED_KEYS.map((key) => (
              <button
                key={key}
                onClick={() => handleSuggestion(key)}
                disabled={loading}
                className="rounded-full border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
              >
                {t(key)}
              </button>
            ))}
          </div>
        </div>

        {/* Input */}
        <Card>
          <CardContent className="p-3">
            <form onSubmit={handleSubmit} className="flex gap-3 items-end">
              <textarea
                ref={textareaRef}
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none min-h-[56px] max-h-[160px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder={t("placeholder")}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
              />
              <Button
                type="submit"
                disabled={loading || !inputText.trim()}
                size="icon"
                className="h-10 w-10 shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <p className="text-[11px] text-muted-foreground mt-1.5 pl-1">
              {t("enterToSend")}
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
