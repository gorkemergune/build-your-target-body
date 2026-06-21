"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { trackFeature } from "@/lib/analytics";
import { CheckCircle2, Circle, Flame, ChevronRight, Loader2 } from "lucide-react";

interface Mission {
  id: number;
  title: string;
  icon: string | null;
  completed_today: boolean;
  streak: number;
}

interface MissionsData {
  missions: Mission[];
  completed: number;
  total: number;
}

// SVG ring progress
function RingProgress({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? value / max : 0;
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  const allDone = value === max && max > 0;

  return (
    <div className="relative flex items-center justify-center w-16 h-16 shrink-0">
      <svg width="64" height="64" className="-rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="5"
          className="text-muted/40" />
        <circle cx="32" cy="32" r={r} fill="none"
          stroke={allDone ? "#22c55e" : "#3b82f6"}
          strokeWidth="5"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.4s ease" }}
        />
      </svg>
      <span className={`absolute text-sm font-bold ${allDone ? "text-green-500" : "text-foreground"}`}>
        {value}/{max}
      </span>
    </div>
  );
}

export function DailyMissionsCard({ locale }: { locale: string }) {
  const t = useTranslations("habits");
  const [data, setData] = useState<MissionsData | null>(null);
  const [toggling, setToggling] = useState<Set<number>>(new Set());

  const load = useCallback(() => {
    api.get("/api/v1/habits/daily-missions")
      .then((r) => setData(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggle(mission: Mission) {
    if (toggling.has(mission.id)) return;
    setToggling((prev) => new Set(prev).add(mission.id));

    // Optimistic update
    setData((prev) => {
      if (!prev) return prev;
      const updated = prev.missions.map((m) =>
        m.id === mission.id ? { ...m, completed_today: !m.completed_today } : m
      );
      return {
        ...prev,
        missions: updated,
        completed: updated.filter((m) => m.completed_today).length,
      };
    });

    try {
      if (!mission.completed_today) {
        await api.post(`/api/v1/habits/${mission.id}/complete`);
        trackFeature("habit_complete");
      } else {
        await api.delete(`/api/v1/habits/${mission.id}/complete`);
      }
      // Re-fetch to get updated streak
      load();
    } catch {
      // Revert optimistic update on error
      load();
    } finally {
      setToggling((prev) => {
        const next = new Set(prev);
        next.delete(mission.id);
        return next;
      });
    }
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="pt-5 pb-4 flex items-center justify-center h-20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const allDone = data.completed === data.total && data.total > 0;

  return (
    <Card className={allDone ? "border-green-300 dark:border-green-700" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="text-lg">🎯</span>
            {t("missionsTitle")}
          </CardTitle>
          <Link
            href={`/${locale}/habits`}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors"
          >
            {t("manage")}
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {data.missions.length === 0 ? (
          <div className="text-center py-4 space-y-2">
            <p className="text-sm text-muted-foreground">{t("noMissions")}</p>
            <Link
              href={`/${locale}/habits`}
              className="text-sm text-primary hover:underline"
            >
              {t("setupHabits")}
            </Link>
          </div>
        ) : (
          <div className="flex items-start gap-4">
            <RingProgress value={data.completed} max={data.total} />
            <div className="flex-1 space-y-2 min-w-0">
              {allDone && (
                <p className="text-xs font-semibold text-green-600 dark:text-green-400 mb-2">
                  ✨ {t("allDone")}
                </p>
              )}
              {data.missions.map((m) => (
                <button
                  key={m.id}
                  onClick={() => toggle(m)}
                  disabled={toggling.has(m.id)}
                  className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-all text-left
                    ${m.completed_today
                      ? "bg-green-50 dark:bg-green-950/20"
                      : "hover:bg-muted/50"
                    }`}
                >
                  {toggling.has(m.id) ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                  ) : m.completed_today ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="text-sm shrink-0">{m.icon ?? "🎯"}</span>
                  <span className={`text-sm flex-1 truncate ${m.completed_today ? "line-through text-muted-foreground" : "font-medium"}`}>
                    {m.title}
                  </span>
                  {m.streak > 0 && (
                    <span className="flex items-center gap-0.5 text-xs text-amber-600 dark:text-amber-400 shrink-0">
                      <Flame className="h-3 w-3" />
                      {m.streak}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
