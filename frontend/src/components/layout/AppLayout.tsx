"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { useAuthStore } from "@/stores/auth";
import { cn } from "@/lib/utils";

export function AppLayout({ children, locale }: { children: React.ReactNode; locale: string }) {
  const { isAuthenticated, fetchMe } = useAuthStore();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      {/* Mobile overlay — closes sidebar when tapping outside */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — fixed overlay on mobile, in-flow on desktop */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-30 transition-transform duration-200",
          "md:static md:z-auto",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <Sidebar locale={locale} onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Content area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-1.5 hover:bg-accent transition-colors"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-semibold text-primary text-sm">Build Your Target Body</span>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
