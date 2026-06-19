"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Scale, Dumbbell, UtensilsCrossed, Bot } from "lucide-react";

const ACTIONS = [
  { key: "addWeight", icon: Scale, href: "weight", color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30" },
  { key: "addWorkout", icon: Dumbbell, href: "workouts", color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-950/30" },
  { key: "addNutrition", icon: UtensilsCrossed, href: "nutrition", color: "text-green-500", bg: "bg-green-50 dark:bg-green-950/30" },
  { key: "askAi", icon: Bot, href: "ai-coach", color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-950/30" },
] as const;

export function QuickActionsCard({ locale }: { locale: string }) {
  const t = useTranslations("dashboard");

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
          {t("quickActions")}
        </p>
        <div className="grid grid-cols-4 gap-2">
          {ACTIONS.map(({ key, icon: Icon, href, color, bg }) => (
            <Link
              key={key}
              href={`/${locale}/${href}`}
              className="flex flex-col items-center gap-2 rounded-xl p-3 transition-colors hover:bg-accent active:scale-95"
            >
              <div className={`rounded-xl p-2.5 ${bg}`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <span className="text-xs font-medium text-center leading-tight">
                {t(key as any)}
              </span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
