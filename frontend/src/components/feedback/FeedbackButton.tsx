"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";
import { useTranslations } from "next-intl";

export function FeedbackButton({ locale }: { locale: string }) {
  const pathname = usePathname();
  const t = useTranslations("feedback");

  if (pathname.includes("/feedback")) return null;

  return (
    <Link
      href={`/${locale}/feedback`}
      className="fixed bottom-20 right-3 z-40 md:bottom-6 md:right-6 flex items-center gap-1.5 rounded-full bg-primary px-2 py-2 md:px-3 md:py-2 text-xs font-medium text-primary-foreground shadow-lg hover:bg-primary/90 transition-all"
      title={t("btnLabel")}
    >
      <MessageSquarePlus className="h-4 w-4 shrink-0" />
      <span className="hidden md:inline">{t("btnLabel")}</span>
    </Link>
  );
}
