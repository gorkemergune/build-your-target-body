"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  Scale,
  Percent,
  Ruler,
  UtensilsCrossed,
  Dumbbell,
  Bot,
  User,
  LogOut,
  Target,
  FileText,
  Camera,
  MessageSquarePlus,
  Settings,
  Sparkles,
  ListChecks,
  Share2,
  ChefHat,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";

interface SidebarProps {
  locale: string;
  onClose?: () => void;
}

export function Sidebar({ locale, onClose }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const logout = useAuthStore((s) => s.logout);

  const navItems = [
    { href: "dashboard", label: t("dashboard"), icon: LayoutDashboard },
    { href: "goals", label: t("goals"), icon: Target },
    { href: "weight", label: t("weight"), icon: Scale },
    { href: "body-fat", label: t("bodyFat"), icon: Percent },
    { href: "measurements", label: t("measurements"), icon: Ruler },
    { href: "nutrition", label: t("nutrition"), icon: UtensilsCrossed },
    { href: "meal-planner", label: t("mealPlanner"), icon: ChefHat },
    { href: "workouts", label: t("workouts"), icon: Dumbbell },
    { href: "photos", label: t("photos"), icon: Camera },
    { href: "reports", label: t("reports"), icon: FileText },
    { href: "habits", label: t("habits"), icon: ListChecks },
    { href: "share", label: t("share"), icon: Share2 },
    { href: "ai-coach", label: t("aiCoach"), icon: Bot },
    { href: "coach/insights", label: t("coachInsights"), icon: Sparkles },
    { href: "feedback", label: t("feedback"), icon: MessageSquarePlus },
    { href: "profile", label: t("profile"), icon: User },
    { href: "settings/data", label: t("settings"), icon: Settings },
  ];

  return (
    <aside className="w-64 h-full min-h-screen bg-card border-r flex flex-col">
      <div className="p-6 border-b">
        <h1 className="font-bold text-lg text-primary leading-tight">
          Build Your
          <br />
          Target Body
        </h1>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const fullHref = `/${locale}/${href}`;
          const isActive = pathname === fullHref || pathname.startsWith(`${fullHref}/`);
          return (
            <Link
              key={href}
              href={fullHref}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t">
        <button
          onClick={() => { logout(); onClose?.(); }}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {t("logout")}
        </button>
      </div>
    </aside>
  );
}
