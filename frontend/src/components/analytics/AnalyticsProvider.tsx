"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { trackPage } from "@/lib/analytics";

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    trackPage(pathname);
  }, [pathname]);

  return <>{children}</>;
}
