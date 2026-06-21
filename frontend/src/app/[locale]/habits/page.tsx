"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import {
  CheckCircle2,
  Flame,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  ListChecks,
} from "lucide-react";

interface Habit {
  id: number;
  title: string;
  icon: string | null;
  target_frequency: string;
  active: boolean;
  completed_today: boolean;
  streak: number;
  history_7d: string[];
}

const EMOJI_OPTIONS = ["⚖️", "🥩", "💧", "🏋️", "😴", "🧘", "🥗", "🚶", "🧠", "💊", "🚰", "🍎", "📏", "🏃", "🛌"];

// Generate last 7 dates as ISO strings
function last7Dates(): string[] {
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export default function HabitsPage({ params: { locale } }: { params: { locale: string } }) {
  const t = useTranslations("habits");

  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newIcon, setNewIcon] = useState("🎯");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const dates7 = last7Dates();

  const load = useCallback(() => {
    api.get("/api/v1/habits")
      .then((r) => setHabits(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      await api.post("/api/v1/habits", { title: newTitle.trim(), icon: newIcon });
      setNewTitle("");
      load();
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(h: Habit) {
    setTogglingId(h.id);
    try {
      await api.patch(`/api/v1/habits/${h.id}`, { active: !h.active });
      load();
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm(t("deleteConfirm"))) return;
    setDeletingId(id);
    try {
      await api.delete(`/api/v1/habits/${id}`);
      load();
    } finally {
      setDeletingId(null);
    }
  }

  async function handleComplete(h: Habit) {
    try {
      if (!h.completed_today) {
        await api.post(`/api/v1/habits/${h.id}/complete`);
      } else {
        await api.delete(`/api/v1/habits/${h.id}/complete`);
      }
      load();
    } catch {}
  }

  const activeHabits = habits.filter((h) => h.active);
  const inactiveHabits = habits.filter((h) => !h.active);
  const todayCompleted = activeHabits.filter((h) => h.completed_today).length;

  return (
    <AppLayout locale={locale}>
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t("pageTitle")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("pageSubtitle")}</p>
          </div>
          {activeHabits.length > 0 && (
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">{todayCompleted}/{activeHabits.length}</p>
              <p className="text-xs text-muted-foreground">{t("todayDone")}</p>
            </div>
          )}
        </div>

        {/* Add habit */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {t("addHabit")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">{t("chooseIcon")}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setNewIcon(emoji)}
                      className={`w-9 h-9 text-lg rounded-lg border-2 transition-all
                        ${newIcon === emoji ? "border-primary bg-primary/10 scale-110" : "border-transparent hover:border-border"}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={t("habitPlaceholder")}
                  maxLength={200}
                  required
                  className="flex-1"
                />
                <Button type="submit" disabled={creating || !newTitle.trim()}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : t("create")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Active habits */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : activeHabits.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <ListChecks className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">{t("noHabits")}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {t("active")} ({activeHabits.length})
            </h2>
            {activeHabits.map((h) => (
              <HabitRow
                key={h.id}
                habit={h}
                dates7={dates7}
                locale={locale}
                deleting={deletingId === h.id}
                toggling={togglingId === h.id}
                onComplete={() => handleComplete(h)}
                onToggleActive={() => handleToggleActive(h)}
                onDelete={() => handleDelete(h.id)}
              />
            ))}
          </div>
        )}

        {/* Inactive habits */}
        {inactiveHabits.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {t("paused")} ({inactiveHabits.length})
            </h2>
            {inactiveHabits.map((h) => (
              <HabitRow
                key={h.id}
                habit={h}
                dates7={dates7}
                locale={locale}
                deleting={deletingId === h.id}
                toggling={togglingId === h.id}
                onComplete={() => handleComplete(h)}
                onToggleActive={() => handleToggleActive(h)}
                onDelete={() => handleDelete(h.id)}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function HabitRow({
  habit,
  dates7,
  locale,
  deleting,
  toggling,
  onComplete,
  onToggleActive,
  onDelete,
}: {
  habit: Habit;
  dates7: string[];
  locale: string;
  deleting: boolean;
  toggling: boolean;
  onComplete: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("habits");
  const completedSet = new Set(habit.history_7d);

  return (
    <Card className={!habit.active ? "opacity-60" : ""}>
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-3">
          {/* Complete toggle */}
          <button
            onClick={onComplete}
            disabled={!habit.active}
            className="shrink-0"
            title={habit.completed_today ? t("uncomplete") : t("completeToday")}
          >
            {habit.completed_today ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/40 hover:border-primary transition-colors" />
            )}
          </button>

          {/* Icon + title */}
          <span className="text-xl shrink-0">{habit.icon ?? "🎯"}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className={`text-sm font-medium truncate ${!habit.active ? "line-through text-muted-foreground" : ""}`}>
                {habit.title}
              </p>
              {habit.streak > 0 && (
                <span className="flex items-center gap-0.5 text-xs text-amber-600 dark:text-amber-400 shrink-0 font-semibold">
                  <Flame className="h-3 w-3" />
                  {habit.streak}d
                </span>
              )}
            </div>
            {/* 7-day history dots */}
            <div className="mt-1.5 space-y-0.5">
              <div className="flex gap-1">
                {dates7.map((d) => {
                  const done = completedSet.has(d);
                  const isToday = d === new Date().toISOString().slice(0, 10);
                  return (
                    <div
                      key={d}
                      title={new Date(d + "T12:00:00").toLocaleDateString(locale === "tr" ? "tr-TR" : "en-US", { weekday: "short", month: "short", day: "numeric" })}
                      className={`w-4 h-4 rounded-sm transition-all ${
                        done
                          ? "bg-green-500"
                          : isToday
                          ? "bg-muted border-2 border-primary/40"
                          : "bg-muted/60"
                      }`}
                    />
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground">{t("last7days")}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onToggleActive}
              disabled={toggling}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              title={habit.active ? t("pause") : t("resume")}
            >
              {toggling ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : habit.active ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              onClick={onDelete}
              disabled={deleting}
              className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
              title={t("delete")}
            >
              {deleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
