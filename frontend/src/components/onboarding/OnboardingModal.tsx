"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Target, Scale, UtensilsCrossed, Dumbbell, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "bytb_onboarding_done";

const STEPS = [
  { icon: Target, titleKey: "step1_title" as const, descKey: "step1_desc" as const },
  { icon: Scale, titleKey: "step2_title" as const, descKey: "step2_desc" as const },
  { icon: UtensilsCrossed, titleKey: "step3_title" as const, descKey: "step3_desc" as const },
  { icon: Dumbbell, titleKey: "step4_title" as const, descKey: "step4_desc" as const },
  { icon: Bot, titleKey: "step5_title" as const, descKey: "step5_desc" as const },
];

export function OnboardingModal({ locale }: { locale: string }) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const router = useRouter();
  const t = useTranslations("onboarding");

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  function finish() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  function handleNext() {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      finish();
      router.push(`/${locale}/goals`);
    }
  }

  if (!visible) return null;

  const { icon: Icon, titleKey, descKey } = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {step + 1} / {STEPS.length}
          </p>
          <button
            onClick={finish}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("skip")}
          </button>
        </div>

        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-10 w-10 text-primary" />
          </div>
        </div>

        {/* Content */}
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold">{t(titleKey)}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{t(descKey)}</p>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
              )}
            />
          ))}
        </div>

        {/* Button */}
        <Button onClick={handleNext} className="w-full">
          {isLast ? t("done") : t("next")}
        </Button>
      </div>
    </div>
  );
}
