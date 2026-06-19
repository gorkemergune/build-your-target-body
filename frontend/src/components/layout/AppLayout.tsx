"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { useAuthStore } from "@/stores/auth";

export function AppLayout({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: string;
}) {
  const { isAuthenticated, fetchMe } = useAuthStore();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetchMe().finally(() => {
      if (!useAuthStore.getState().isAuthenticated) {
        router.push(`/${locale}/auth/login`);
      }
      setChecking(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar: desktop only */}
      <div className="hidden md:block shrink-0">
        <Sidebar locale={locale} />
      </div>

      {/* Content area */}
      <div className="flex flex-1 flex-col min-w-0">
        <main className="flex-1 overflow-auto p-3 pb-20 md:p-8 md:pb-8">
          {children}
        </main>
      </div>

      {/* Bottom navigation: mobile only */}
      <BottomNav locale={locale} />

      {/* Global overlays */}
      <FeedbackButton locale={locale} />
      <OnboardingModal locale={locale} />
    </div>
  );
}
