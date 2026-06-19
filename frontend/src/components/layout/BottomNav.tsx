"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LayoutDashboard, Scale, Bot, FileText, Camera } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  locale: string;
}

export function BottomNav({ locale }: BottomNavProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  const items = [
    { href: "dashboard", label: t("dashboard"), icon: LayoutDashboard },
    { href: "weight", label: t("track"), icon: Scale },
    { href: "ai-coach", label: t("aiCoach"), icon: Bot },
    { href: "reports", label: t("reports"), icon: FileText },
    { href: "photos", label: t("photos"), icon: Camera },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card/95 backdrop-blur-sm border-t"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex">
        {items.map(({ href, label, icon: Icon }) => {
          const fullHref = `/${locale}/${href}`;
          const isActive =
            pathname === fullHref || pathname.startsWith(`${fullHref}/`);
          return (
            <Link
              key={href}
              href={fullHref}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors min-h-[56px] justify-center",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon
                className={cn("h-5 w-5", isActive && "stroke-[2.5]")}
              />
              <span className="leading-none">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
