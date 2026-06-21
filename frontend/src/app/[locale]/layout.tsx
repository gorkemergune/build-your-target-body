import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";
import { ErrorBoundary } from "@/components/analytics/ErrorBoundary";
import "../globals.css";

export const metadata: Metadata = {
  title: "Build Your Target Body",
  description: "AI-powered body transformation platform",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Target Body",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#3b82f6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className="font-sans antialiased">
        <NextIntlClientProvider messages={messages}>
          <AnalyticsProvider>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </AnalyticsProvider>
          <ServiceWorkerRegister />
          <InstallPrompt />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
