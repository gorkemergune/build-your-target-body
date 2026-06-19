"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Trophy, X } from "lucide-react";
import { api } from "@/lib/api";

const STORAGE_KEY = "bytb_achievements";

interface Achievement {
  id: string;
  unlocked: boolean;
}

export function AchievementToast({ locale: _locale }: { locale: string }) {
  const t = useTranslations("achievements");
  const [queue, setQueue] = useState<string[]>([]);

  useEffect(() => {
    api
      .get("/api/v1/analytics/achievements")
      .then((r) => {
        const current: Achievement[] = r.data;
        const stored: string[] = JSON.parse(
          localStorage.getItem(STORAGE_KEY) ?? "[]"
        );
        const newlyUnlocked = current
          .filter((a) => a.unlocked && !stored.includes(a.id))
          .map((a) => a.id);
        if (newlyUnlocked.length > 0) {
          setQueue(newlyUnlocked);
        }
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(current.filter((a) => a.unlocked).map((a) => a.id))
        );
      })
      .catch(() => {});
  }, []);

  const dismiss = () => setQueue((prev) => prev.slice(1));

  useEffect(() => {
    if (queue.length > 0) {
      const timer = setTimeout(dismiss, 5000);
      return () => clearTimeout(timer);
    }
  }, [queue]);

  if (queue.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[300] flex items-start gap-3 rounded-xl border bg-background shadow-xl px-4 py-3 max-w-xs animate-in slide-in-from-right-4 duration-300">
      <div className="rounded-full bg-yellow-100 dark:bg-yellow-900/30 p-2 shrink-0 mt-0.5">
        <Trophy className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {t("unlocked")}
        </p>
        <p className="text-sm font-semibold mt-0.5 leading-snug">
          {t(queue[0] as any)}
        </p>
        {queue.length > 1 && (
          <p className="text-xs text-muted-foreground mt-0.5">
            +{queue.length - 1} more
          </p>
        )}
      </div>
      <button
        onClick={dismiss}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
