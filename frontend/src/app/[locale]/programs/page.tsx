"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import {
  Dumbbell, Zap, RefreshCw, BarChart2, Flame, Target,
  Printer, ChevronDown, ChevronUp, Loader2, Sparkles,
  CheckCircle2, Clock, Repeat,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type Goal = "weight_loss" | "muscle_gain" | "strength" | "recomposition";
type ExperienceLevel = "beginner" | "intermediate" | "advanced";
type TemplateType = "full_body" | "upper_lower" | "push_pull_legs" | "powerbuilding" | "strength" | "hypertrophy";
type Equipment = "barbell" | "dumbbell" | "cable_machine" | "resistance_bands" | "bodyweight" | "kettlebell" | "pull_up_bar" | "smith_machine";

interface ExerciseItem {
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  notes: string | null;
  progression: string | null;
}

interface WorkoutDay {
  day_name: string;
  focus: string;
  exercises: ExerciseItem[];
}

interface GeneratedProgram {
  program_name: string;
  overview: string;
  duration_weeks: number;
  days: WorkoutDay[];
  progression_guidance: string;
  ai_explanation: string;
  expected_outcomes: string;
}

// ── Config data ────────────────────────────────────────────────────────────────

const GOALS: { value: Goal; icon: React.ElementType }[] = [
  { value: "muscle_gain", icon: Dumbbell },
  { value: "strength", icon: BarChart2 },
  { value: "weight_loss", icon: Flame },
  { value: "recomposition", icon: RefreshCw },
];

const TEMPLATES: { value: TemplateType; icon: React.ElementType; days: string }[] = [
  { value: "full_body", icon: Zap, days: "2-4" },
  { value: "upper_lower", icon: RefreshCw, days: "4" },
  { value: "push_pull_legs", icon: Repeat, days: "3-6" },
  { value: "powerbuilding", icon: BarChart2, days: "4-5" },
  { value: "strength", icon: Target, days: "3-5" },
  { value: "hypertrophy", icon: Dumbbell, days: "4-6" },
];

const EQUIPMENT_LIST: Equipment[] = [
  "barbell", "dumbbell", "cable_machine", "resistance_bands",
  "bodyweight", "kettlebell", "pull_up_bar", "smith_machine",
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ProgramsPage({ params: { locale } }: { params: { locale: string } }) {
  const t = useTranslations("programs");

  const [goal, setGoal] = useState<Goal>("muscle_gain");
  const [experience, setExperience] = useState<ExperienceLevel>("intermediate");
  const [trainingDays, setTrainingDays] = useState(4);
  const [equipment, setEquipment] = useState<Set<Equipment>>(new Set(["barbell", "dumbbell", "cable_machine", "bodyweight", "pull_up_bar"]));
  const [template, setTemplate] = useState<TemplateType>("hypertrophy");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [program, setProgram] = useState<GeneratedProgram | null>(null);
  const [activeDay, setActiveDay] = useState(0);

  function toggleEquipment(e: Equipment) {
    setEquipment((prev) => {
      const next = new Set(prev);
      if (next.has(e)) { next.delete(e); } else { next.add(e); }
      return next;
    });
  }

  async function handleGenerate() {
    if (equipment.size === 0) {
      setError(t("equipmentRequired"));
      return;
    }
    setLoading(true);
    setError(null);
    setProgram(null);
    try {
      const res = await api.post("/api/v1/ai/generate-program", {
        goal,
        experience_level: experience,
        training_days: trainingDays,
        equipment: Array.from(equipment),
        template_type: template,
        language: locale === "tr" ? "tr" : "en",
      });
      setProgram(res.data);
      setActiveDay(0);
    } catch (e: any) {
      if (e?.response?.status === 429) {
        setError(t("quotaError"));
      } else {
        setError(e?.response?.data?.detail || t("generateError"));
      }
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <AppLayout locale={locale}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-full { width: 100% !important; max-width: none !important; }
          body { background: white; }
          .day-tab-btn { display: none; }
          .day-panel { display: block !important; page-break-inside: avoid; margin-bottom: 2rem; }
        }
      `}</style>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t("title")}</h1>
            <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
          </div>
          {program && (
            <Button variant="outline" onClick={handlePrint} className="no-print gap-2">
              <Printer className="h-4 w-4" />
              {t("exportPdf")}
            </Button>
          )}
        </div>

        {/* ── Configuration ── */}
        <div className="no-print space-y-4">
          {/* Template */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("selectTemplate")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {TEMPLATES.map(({ value, icon: Icon, days }) => (
                  <button
                    key={value}
                    onClick={() => setTemplate(value)}
                    className={`flex flex-col gap-1 p-3 rounded-lg border text-left transition-all ${
                      template === value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/40 hover:bg-muted/50"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-semibold text-sm">{t(`template_${value}`)}</span>
                    <span className="text-xs text-muted-foreground">{days} {t("daysPerWeek")}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Goal */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">{t("selectGoal")}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {GOALS.map(({ value, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => setGoal(value)}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm font-medium transition-all ${
                        goal === value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/40 hover:bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {t(`goal_${value}`)}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Experience + Days */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">{t("experienceAndDays")}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-1">
                  {(["beginner", "intermediate", "advanced"] as ExperienceLevel[]).map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => setExperience(lvl)}
                      className={`flex-1 py-2 rounded-md text-xs font-medium border transition-all ${
                        experience === lvl
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      {t(`exp_${lvl}`)}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground shrink-0">{t("trainingDays")}:</span>
                  <div className="flex gap-1">
                    {[2, 3, 4, 5, 6].map((d) => (
                      <button
                        key={d}
                        onClick={() => setTrainingDays(d)}
                        className={`w-9 h-9 rounded-md text-sm font-medium border transition-all ${
                          trainingDays === d
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border hover:bg-muted/50 text-muted-foreground"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Equipment */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">{t("selectEquipment")}</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {EQUIPMENT_LIST.map((eq) => (
                  <button
                    key={eq}
                    onClick={() => toggleEquipment(eq)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                      equipment.has(eq)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/40 text-muted-foreground"
                    }`}
                  >
                    {equipment.has(eq) && <CheckCircle2 className="inline h-3 w-3 mr-1" />}
                    {t(`equip_${eq}`)}
                  </button>
                ))}
              </div>
              {equipment.size === 0 && (
                <p className="text-xs text-destructive mt-2">{t("equipmentRequired")}</p>
              )}
            </CardContent>
          </Card>

          {/* Generate button */}
          <Button
            onClick={handleGenerate}
            disabled={loading || equipment.size === 0}
            size="lg"
            className="w-full gap-2 h-12"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {t("generating")}
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                {t("generateProgram")}
              </>
            )}
          </Button>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        {/* ── Generated Program ── */}
        {program && <ProgramDisplay program={program} activeDay={activeDay} setActiveDay={setActiveDay} t={t} />}
      </div>
    </AppLayout>
  );
}

// ── Program Display ───────────────────────────────────────────────────────────

function ProgramDisplay({
  program, activeDay, setActiveDay, t,
}: {
  program: GeneratedProgram;
  activeDay: number;
  setActiveDay: (i: number) => void;
  t: ReturnType<typeof useTranslations<"programs">>;
}) {
  return (
    <div className="space-y-4 print-full">
      {/* Header */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="py-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-xl font-bold">{program.program_name}</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{program.overview}</p>
            </div>
            <div className="flex gap-4 text-center shrink-0">
              <div>
                <p className="text-2xl font-bold text-primary">{program.duration_weeks}</p>
                <p className="text-xs text-muted-foreground">{t("weeks")}</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">{program.days.length}</p>
                <p className="text-xs text-muted-foreground">{t("days")}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Day tabs */}
      <div className="flex gap-1 overflow-x-auto day-tab-btn pb-1 no-print">
        {program.days.map((day, i) => (
          <button
            key={i}
            onClick={() => setActiveDay(i)}
            className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap border transition-all shrink-0 ${
              activeDay === i
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-muted/30 hover:bg-muted/60 text-muted-foreground"
            }`}
          >
            {day.day_name}
          </button>
        ))}
      </div>

      {/* Days */}
      {program.days.map((day, i) => (
        <div
          key={i}
          className={`day-panel ${i === activeDay ? "block" : "hidden"}`}
        >
          <DayCard day={day} t={t} />
        </div>
      ))}

      {/* AI sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InfoCard
          icon={<Sparkles className="h-4 w-4 text-primary" />}
          title={t("aiExplanation")}
          body={program.ai_explanation}
        />
        <InfoCard
          icon={<Target className="h-4 w-4 text-primary" />}
          title={t("expectedOutcomes")}
          body={program.expected_outcomes}
        />
      </div>

      <InfoCard
        icon={<BarChart2 className="h-4 w-4 text-primary" />}
        title={t("progressionGuidance")}
        body={program.progression_guidance}
      />
    </div>
  );
}

// ── Day Card ──────────────────────────────────────────────────────────────────

function DayCard({ day, t }: { day: WorkoutDay; t: ReturnType<typeof useTranslations<"programs">> }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggleEx(i: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) { next.delete(i); } else { next.add(i); }
      return next;
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span>{day.day_name}</span>
          <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">
            {day.focus}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {day.exercises.map((ex, i) => (
          <ExerciseRow
            key={i}
            ex={ex}
            index={i}
            isExpanded={expanded.has(i)}
            onToggle={() => toggleEx(i)}
            t={t}
          />
        ))}
      </CardContent>
    </Card>
  );
}

// ── Exercise Row ──────────────────────────────────────────────────────────────

function ExerciseRow({
  ex, index, isExpanded, onToggle, t,
}: {
  ex: ExerciseItem;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  t: ReturnType<typeof useTranslations<"programs">>;
}) {
  const hasDetail = ex.notes || ex.progression;

  return (
    <div className="rounded-lg border bg-muted/20 overflow-hidden">
      <div
        className={`flex items-center gap-3 px-3 py-2.5 ${hasDetail ? "cursor-pointer hover:bg-muted/40" : ""}`}
        onClick={hasDetail ? onToggle : undefined}
      >
        <span className="w-6 text-xs font-bold text-muted-foreground text-center shrink-0">{index + 1}</span>
        <span className="flex-1 font-medium text-sm">{ex.name}</span>
        <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
          <span className="flex items-center gap-1">
            <Repeat className="h-3 w-3" />
            {ex.reps}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {ex.rest_seconds}s
          </span>
        </div>
        {hasDetail && (
          <span className="text-muted-foreground shrink-0">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        )}
      </div>
      {isExpanded && (
        <div className="border-t px-3 py-2.5 space-y-1.5 bg-muted/10">
          {ex.notes && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{t("notes")}: </span>
              {ex.notes}
            </p>
          )}
          {ex.progression && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{t("progression")}: </span>
              {ex.progression}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Info Card ─────────────────────────────────────────────────────────────────

function InfoCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
      </CardContent>
    </Card>
  );
}
