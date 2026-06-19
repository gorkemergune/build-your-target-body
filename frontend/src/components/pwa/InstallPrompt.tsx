"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let _deferred: BeforeInstallPromptEvent | null = null;

export function InstallPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      _deferred = e as BeforeInstallPromptEvent;
      setShow(true);
    };
    const onInstalled = () => {
      setShow(false);
      _deferred = null;
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!show) return null;

  async function handleInstall() {
    if (!_deferred) return;
    await _deferred.prompt();
    await _deferred.userChoice;
    _deferred = null;
    setShow(false);
  }

  return (
    <div className="fixed bottom-[4.5rem] md:bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-80 bg-card border rounded-xl shadow-lg p-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5 h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Download className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Install App</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Add Build Your Target Body to your homescreen for the best experience.
          </p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={handleInstall} className="h-8 text-xs px-3">
              Install
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShow(false)}
              className="h-8 text-xs px-3"
            >
              Not now
            </Button>
          </div>
        </div>
        <button
          onClick={() => setShow(false)}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
