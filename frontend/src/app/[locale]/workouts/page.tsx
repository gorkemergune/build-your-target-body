"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FrequencyChart } from "@/components/charts/FrequencyChart";
import { StatsBar } from "@/components/tracking/StatsBar";
import { EmptyState } from "@/components/tracking/EmptyState";
import { ExercisePickerModal } from "@/components/workouts/ExercisePickerModal";
import type { PickedExercise } from "@/components/workouts/ExercisePickerModal";
import { WorkoutSession } from "@/components/workouts/WorkoutSession";
import { api } from "@/lib/api";
import { todayISO, localeDateToISO } from "@/lib/utils";
import type { Workout, WorkoutAnalytics, WorkoutType, SetType } from "@/types";
import {
  Dumbbell, Plus, Trash2, BookOpen, ChevronDown, ChevronUp,
  Flame, Route, Timer, Heart, Zap, Activity,
  ListChecks, PenLine, Play, LayoutList, X as XIcon,
} from "lucide-react";

// ── Program types ─────────────────────────────────────────────────────────────

interface ProgramExercise {
  id: number;
  exercise_name: string;
  exercise_id: number | null;
  order_index: number;
  target_sets: number | null;
  target_reps: string | null;
  notes: string | null;
}

interface ProgramDay {
  id: number;
  day_number: number;
  name: string;
  exercises: ProgramExercise[];
}

interface UserProgram {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  days: ProgramDay[];
}

// ── Types ────────────────────────────────────────────────────────────────────

interface SetRow {
  uid: string;
  set_type: SetType;
  reps: string;
  weight_kg: string;
  rpe: string;
  duration_seconds: string;
  distance_km: string;
  notes: string;
}

interface ExRow {
  uid: string;
  exercise_name: string;
  exercise_id: number | null;
  notes: string;
  sets: SetRow[];
  collapsed: boolean;
}

function uid() {
  return Math.random().toString(36).slice(2);
}

function emptySet(type: SetType = "working"): SetRow {
  return { uid: uid(), set_type: type, reps: "", weight_kg: "", rpe: "", duration_seconds: "", distance_km: "", notes: "" };
}

function emptyExercise(): ExRow {
  return {
    uid: uid(),
    exercise_name: "",
    exercise_id: null,
    notes: "",
    sets: [emptySet()],
    collapsed: false,
  };
}

const WORKOUT_TYPES: { value: WorkoutType; labelKey: string; icon: React.ElementType; isCardio: boolean }[] = [
  { value: "strength", labelKey: "typeStrength", icon: Dumbbell, isCardio: false },
  { value: "cardio", labelKey: "typeCardio", icon: Flame, isCardio: true },
  { value: "running", labelKey: "typeRunning", icon: Route, isCardio: true },
  { value: "cycling", labelKey: "typeCycling", icon: Activity, isCardio: true },
  { value: "pilates", labelKey: "typePilates", icon: Zap, isCardio: false },
  { value: "crossfit", labelKey: "typeCrossFit", icon: Timer, isCardio: false },
];

// ── Live Summary ──────────────────────────────────────────────────────────────

function calcSummary(exercises: ExRow[]) {
  let vol = 0, sets = 0, reps = 0;
  for (const ex of exercises) {
    for (const s of ex.sets) {
      if (s.set_type === "working") {
        sets++;
        const r = parseInt(s.reps) || 0;
        const w = parseFloat(s.weight_kg) || 0;
        reps += r;
        vol += r * w;
      }
    }
  }
  return { vol: Math.round(vol * 10) / 10, sets, reps };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function WorkoutsPage({ params: { locale } }: { params: { locale: string } }) {
  const t = useTranslations("workouts");
  const tc = useTranslations("common");

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [analytics, setAnalytics] = useState<WorkoutAnalytics | null>(null);
  const [freqData, setFreqData] = useState<{ date: string; value: number }[]>([]);

  // Form
  const [workoutType, setWorkoutType] = useState<WorkoutType>("strength");
  const [name, setName] = useState("");
  const [date, setDate] = useState(todayISO());
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [exercises, setExercises] = useState<ExRow[]>([emptyExercise()]);
  // Cardio extras
  const [distance, setDistance] = useState("");
  const [calories, setCalories] = useState("");
  const [heartRate, setHeartRate] = useState("");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<string | null>(null);

  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionInitial, setSessionInitial] = useState<{ exercises: { exercise_name: string; exercise_id: number | null }[]; name: string } | null>(null);

  // My Programs
  const [programs, setPrograms] = useState<UserProgram[]>([]);
  const [programsOpen, setProgramsOpen] = useState(false);
  const [createProgramOpen, setCreateProgramOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<UserProgram | null>(null);

  const isCardio = WORKOUT_TYPES.find((t) => t.value === workoutType)?.isCardio ?? false;

  const fetchAll = () =>
    Promise.allSettled([
      api.get("/api/v1/workouts").then((r) => setWorkouts(r.data)),
      api.get("/api/v1/analytics/workout-analytics").then((r) => setAnalytics(r.data)),
      api.get("/api/v1/analytics/workout-frequency?days=30").then((r) => setFreqData(r.data)),
      api.get("/api/v1/user-programs").then((r) => setPrograms(r.data)),
    ]);

  useEffect(() => { fetchAll(); }, []);

  // ── Exercise helpers ──

  function addExercise() {
    setExercises((p) => [...p, emptyExercise()]);
  }

  function removeExercise(uid: string) {
    setExercises((p) => p.filter((e) => e.uid !== uid));
  }

  function updateExercise(uid: string, patch: Partial<ExRow>) {
    setExercises((p) => p.map((e) => e.uid === uid ? { ...e, ...patch } : e));
  }

  function toggleCollapse(uid: string) {
    setExercises((p) => p.map((e) => e.uid === uid ? { ...e, collapsed: !e.collapsed } : e));
  }

  // ── Set helpers ──

  function addSet(exUid: string, type: SetType) {
    setExercises((p) =>
      p.map((e) => e.uid === exUid
        ? { ...e, sets: [...e.sets, emptySet(type)] }
        : e
      )
    );
  }

  function updateSet(exUid: string, setUid: string, patch: Partial<SetRow>) {
    setExercises((p) =>
      p.map((e) =>
        e.uid === exUid
          ? { ...e, sets: e.sets.map((s) => s.uid === setUid ? { ...s, ...patch } : s) }
          : e
      )
    );
  }

  function removeSet(exUid: string, setUid: string) {
    setExercises((p) =>
      p.map((e) =>
        e.uid === exUid
          ? { ...e, sets: e.sets.filter((s) => s.uid !== setUid) }
          : e
      )
    );
  }

  // ── Picker ──

  function openPicker(exUid: string | null) {
    setPickerTarget(exUid);
    setPickerOpen(true);
  }

  function handlePickerSelect(ex: PickedExercise) {
    if (pickerTarget === null) {
      setExercises((p) => [...p, { ...emptyExercise(), exercise_name: ex.name, exercise_id: ex.id }]);
    } else {
      updateExercise(pickerTarget, { exercise_name: ex.name, exercise_id: ex.id });
    }
    setPickerOpen(false);
    setPickerTarget(null);
  }

  // ── Programs helpers ──

  async function deleteProgram(id: number) {
    if (!confirm(t("confirmDeleteProgram"))) return;
    await api.delete(`/api/v1/user-programs/${id}`);
    setPrograms((p) => p.filter((pr) => pr.id !== id));
  }

  function startFromDay(program: UserProgram, day: ProgramDay) {
    setSessionInitial({
      name: `${program.name} — ${day.name}`,
      exercises: day.exercises.map((e) => ({ exercise_name: e.exercise_name, exercise_id: e.exercise_id })),
    });
    setSessionOpen(true);
  }

  function logFromDay(program: UserProgram, day: ProgramDay) {
    setName(`${program.name} — ${day.name}`);
    setExercises(day.exercises.map((e) => ({
      uid: uid(),
      exercise_name: e.exercise_name,
      exercise_id: e.exercise_id,
      notes: e.notes ?? "",
      sets: [emptySet()],
      collapsed: false,
    })));
    // Scroll to the log form
    document.getElementById("log-form-anchor")?.scrollIntoView({ behavior: "smooth" });
  }

  // ── Submit ──

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const exPayload = exercises
        .filter((ex) => ex.exercise_name.trim())
        .map((ex, i) => ({
          exercise_name: ex.exercise_name.trim(),
          exercise_id: ex.exercise_id,
          order_index: i,
          notes: ex.notes.trim() || undefined,
          sets_data: ex.sets
            .filter((s) => s.reps || s.weight_kg || s.duration_seconds || s.distance_km)
            .map((s, si) => ({
              set_number: si + 1,
              set_type: s.set_type,
              reps: s.reps ? parseInt(s.reps) : undefined,
              weight_kg: s.weight_kg ? parseFloat(s.weight_kg) : undefined,
              rpe: s.rpe ? parseFloat(s.rpe) : undefined,
              duration_seconds: s.duration_seconds ? parseInt(s.duration_seconds) : undefined,
              distance_km: s.distance_km ? parseFloat(s.distance_km) : undefined,
              notes: s.notes.trim() || undefined,
            })),
        }));

      await api.post("/api/v1/workouts", {
        name: name.trim(),
        logged_at: localeDateToISO(date),
        workout_type: workoutType,
        duration_minutes: duration ? parseInt(duration) : undefined,
        notes: notes.trim() || undefined,
        distance_km: distance ? parseFloat(distance) : undefined,
        calories_burned: calories ? parseFloat(calories) : undefined,
        avg_heart_rate: heartRate ? parseInt(heartRate) : undefined,
        exercises: isCardio ? [] : exPayload,
      });

      // Reset form
      setName(""); setDate(todayISO()); setDuration(""); setNotes("");
      setDistance(""); setCalories(""); setHeartRate("");
      setExercises([emptyExercise()]);
      fetchAll();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm(tc("deleteConfirm"))) return;
    setDeleting(id);
    try {
      await api.delete(`/api/v1/workouts/${id}`);
      fetchAll();
    } finally { setDeleting(null); }
  }

  const liveSummary = calcSummary(exercises);

  const statItems = analytics ? [
    { label: t("thisWeek"), value: String(analytics.workouts_this_week) },
    { label: t("thisMonth"), value: String(analytics.workouts_this_month) },
    { label: t("totalVolume"), value: analytics.total_volume_kg > 0 ? `${analytics.total_volume_kg.toLocaleString()} kg` : "—" },
    { label: t("avgDuration"), value: analytics.avg_duration_minutes != null ? `${analytics.avg_duration_minutes} ${t("min")}` : "—" },
  ] : [];

  return (
    <AppLayout locale={locale}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{t("title")}</h1>

        {analytics && <StatsBar stats={statItems} />}

        <Card>
          <CardHeader><CardTitle className="text-base">{t("frequencyChart")}</CardTitle></CardHeader>
          <CardContent><FrequencyChart data={freqData} /></CardContent>
        </Card>

        {/* ── My Programs ── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <LayoutList className="h-5 w-5 text-primary" />
                {t("myPrograms")}
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setEditingProgram(null); setCreateProgramOpen(true); }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t("createProgram")}
                </Button>
                {programs.length > 0 && (
                  <button
                    onClick={() => setProgramsOpen((p) => !p)}
                    className="p-1.5 rounded-md hover:bg-muted"
                  >
                    {programsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </div>
          </CardHeader>
          {(programsOpen || programs.length === 0) && (
            <CardContent>
              {programs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground gap-2">
                  <ListChecks className="h-8 w-8 opacity-30" />
                  <p className="text-sm font-medium">{t("noProgramsYet")}</p>
                  <p className="text-xs text-center">{t("noProgramsDesc")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {programs.map((prog) => (
                    <ProgramCard
                      key={prog.id}
                      program={prog}
                      t={t}
                      onStartDay={(day) => startFromDay(prog, day)}
                      onLogDay={(day) => logFromDay(prog, day)}
                      onEdit={() => { setEditingProgram(prog); setCreateProgramOpen(true); }}
                      onDelete={() => deleteProgram(prog.id)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* ── Live Workout Mode ── */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold text-base flex items-center gap-2">
                  <Timer className="h-5 w-5 text-primary" />
                  {t("startLiveWorkout")}
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">{t("startLiveWorkoutDesc")}</p>
              </div>
              <Button onClick={() => { setSessionInitial(null); setSessionOpen(true); }} className="shrink-0">
                {t("startNow")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Log Form ── */}
        <div id="log-form-anchor" />
        <Card>
          <CardHeader><CardTitle>{t("logWorkout")}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Workout type selector */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {WORKOUT_TYPES.map(({ value, labelKey, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setWorkoutType(value)}
                    className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg border text-xs font-medium transition-all ${
                      workoutType === value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/30 hover:bg-muted/60 text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {t(labelKey)}
                  </button>
                ))}
              </div>

              {/* Basic fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5 sm:col-span-1">
                  <Label>{t("workoutName")}</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("date")}</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("duration")}</Label>
                  <Input type="number" min="1" max="1440" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="min" />
                </div>
              </div>

              {/* Cardio extras */}
              {isCardio && (
                <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-muted/30 border">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1"><Route className="h-3.5 w-3.5" />{t("distance")}</Label>
                    <Input type="number" step="0.01" min="0" value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="km" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1"><Flame className="h-3.5 w-3.5" />{t("calories")}</Label>
                    <Input type="number" min="0" value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="kcal" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{t("avgHR")}</Label>
                    <Input type="number" min="30" max="250" value={heartRate} onChange={(e) => setHeartRate(e.target.value)} placeholder="bpm" />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>{t("notes")}</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              {/* Exercises (strength types) */}
              {!isCardio && (
                <div className="space-y-3">
                  {exercises.map((ex, exIdx) => (
                    <ExerciseBlock
                      key={ex.uid}
                      ex={ex}
                      exIdx={exIdx}
                      t={t}
                      onOpenPicker={() => openPicker(ex.uid)}
                      onCollapse={() => toggleCollapse(ex.uid)}
                      onRemove={() => removeExercise(ex.uid)}
                      onUpdateName={(v) => updateExercise(ex.uid, { exercise_name: v, exercise_id: null })}
                      onUpdateNotes={(v) => updateExercise(ex.uid, { notes: v })}
                      onAddSet={(type) => addSet(ex.uid, type)}
                      onUpdateSet={(su, patch) => updateSet(ex.uid, su, patch)}
                      onRemoveSet={(su) => removeSet(ex.uid, su)}
                    />
                  ))}

                  {/* Live summary */}
                  {liveSummary.sets > 0 && (
                    <div className="flex gap-4 px-1 text-xs text-muted-foreground">
                      <span>{t("liveVolume")}: <strong className="text-foreground">{liveSummary.vol.toLocaleString()} kg</strong></span>
                      <span>{t("liveSets")}: <strong className="text-foreground">{liveSummary.sets}</strong></span>
                      <span>{t("liveReps")}: <strong className="text-foreground">{liveSummary.reps}</strong></span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => openPicker(null)} className="flex-1">
                      <BookOpen className="h-4 w-4 mr-2" />{t("pickExercise")}
                    </Button>
                    <Button type="button" variant="outline" onClick={addExercise} className="flex-1">
                      <Plus className="h-4 w-4 mr-2" />{t("addExercise")}
                    </Button>
                  </div>
                </div>
              )}

              <Button type="submit" disabled={saving} className="w-full">
                {saving ? "..." : t("logWorkout")}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* ── History ── */}
        <Card>
          <CardHeader><CardTitle>{t("history")}</CardTitle></CardHeader>
          <CardContent>
            {workouts.length === 0 ? (
              <EmptyState icon={Dumbbell} title={t("emptyTitle")} description={t("emptyDescription")} />
            ) : (
              <div className="divide-y">
                {workouts.map((w) => (
                  <WorkoutCard
                    key={w.id}
                    workout={w}
                    locale={locale}
                    deleting={deleting === w.id}
                    onDelete={() => handleDelete(w.id)}
                    t={t}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {pickerOpen && (
        <ExercisePickerModal
          locale={locale}
          onSelect={handlePickerSelect}
          onClose={() => { setPickerOpen(false); setPickerTarget(null); }}
        />
      )}

      {sessionOpen && (
        <WorkoutSession
          locale={locale}
          onClose={() => { setSessionOpen(false); setSessionInitial(null); }}
          onSaved={() => { setSessionOpen(false); setSessionInitial(null); fetchAll(); }}
          initialExercises={sessionInitial?.exercises}
          initialName={sessionInitial?.name}
        />
      )}

      {createProgramOpen && (
        <ProgramFormModal
          locale={locale}
          program={editingProgram}
          t={t}
          onClose={() => { setCreateProgramOpen(false); setEditingProgram(null); }}
          onSaved={(prog) => {
            setPrograms((p) => {
              const idx = p.findIndex((x) => x.id === prog.id);
              if (idx >= 0) { const next = [...p]; next[idx] = prog; return next; }
              return [prog, ...p];
            });
            setCreateProgramOpen(false);
            setEditingProgram(null);
            setProgramsOpen(true);
          }}
        />
      )}
    </AppLayout>
  );
}

// ── Program Card ──────────────────────────────────────────────────────────────

function ProgramCard({
  program, t, onStartDay, onLogDay, onEdit, onDelete,
}: {
  program: UserProgram;
  t: ReturnType<typeof useTranslations<"workouts">>;
  onStartDay: (day: ProgramDay) => void;
  onLogDay: (day: ProgramDay) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);

  const day = program.days[selectedDay];

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-muted/20">
        <LayoutList className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{program.name}</p>
          {program.description && (
            <p className="text-xs text-muted-foreground truncate">{program.description}</p>
          )}
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {program.days.length} {t("day")}
        </span>
        <button onClick={onEdit} className="p-1 rounded hover:bg-muted text-muted-foreground">
          <PenLine className="h-3.5 w-3.5" />
        </button>
        <button onClick={onDelete} className="p-1 rounded hover:bg-muted text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => setExpanded((p) => !p)} className="p-1 rounded hover:bg-muted">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {expanded && program.days.length > 0 && (
        <div className="px-4 pb-4 pt-2 space-y-3">
          {/* Day selector */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
            {program.days.map((d, i) => (
              <button
                key={d.id}
                onClick={() => setSelectedDay(i)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  selectedDay === i
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-muted/30 hover:bg-muted/60 text-muted-foreground"
                }`}
              >
                {d.name}
              </button>
            ))}
          </div>

          {/* Day exercises */}
          {day && (
            <>
              <div className="space-y-1">
                {day.exercises.map((ex, i) => (
                  <div key={ex.id} className="flex items-center gap-2 py-1 text-sm">
                    <span className="w-5 text-xs text-muted-foreground font-bold shrink-0">{i + 1}</span>
                    <span className="flex-1 font-medium truncate">{ex.exercise_name}</span>
                    {(ex.target_sets || ex.target_reps) && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {ex.target_sets && `${ex.target_sets}×`}{ex.target_reps}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={() => onStartDay(day)}
                  className="flex-1 gap-1.5"
                >
                  <Play className="h-3.5 w-3.5" />
                  {t("startFromProgram")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onLogDay(day)}
                  className="flex-1 gap-1.5"
                >
                  <PenLine className="h-3.5 w-3.5" />
                  {t("logFromProgram")}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Program Form Modal ────────────────────────────────────────────────────────

function ProgramFormModal({
  locale, program, t, onClose, onSaved,
}: {
  locale: string;
  program: UserProgram | null;
  t: ReturnType<typeof useTranslations<"workouts">>;
  onClose: () => void;
  onSaved: (prog: UserProgram) => void;
}) {
  const isEdit = !!program;
  const [name, setName] = useState(program?.name ?? "");
  const [description, setDescription] = useState(program?.description ?? "");
  const [days, setDays] = useState<{ day_number: number; name: string; exercises: { exercise_name: string; exercise_id: number | null; order_index: number; target_sets: string; target_reps: string }[] }[]>(
    program?.days.map((d) => ({
      day_number: d.day_number,
      name: d.name,
      exercises: d.exercises.map((e) => ({
        exercise_name: e.exercise_name,
        exercise_id: e.exercise_id,
        order_index: e.order_index,
        target_sets: e.target_sets ? String(e.target_sets) : "",
        target_reps: e.target_reps ?? "",
      })),
    })) ?? []
  );
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerDayIdx, setPickerDayIdx] = useState<number | null>(null);

  function addDay() {
    setDays((p) => [...p, { day_number: p.length + 1, name: `${t("day")} ${p.length + 1}`, exercises: [] }]);
  }

  function removeDay(i: number) {
    setDays((p) => p.filter((_, idx) => idx !== i).map((d, idx) => ({ ...d, day_number: idx + 1 })));
  }

  function addExToDay(dayIdx: number, ex: PickedExercise) {
    setDays((p) => p.map((d, i) =>
      i !== dayIdx ? d : {
        ...d,
        exercises: [...d.exercises, {
          exercise_name: ex.name,
          exercise_id: ex.id,
          order_index: d.exercises.length,
          target_sets: "",
          target_reps: "",
        }],
      }
    ));
  }

  function removeExFromDay(dayIdx: number, exIdx: number) {
    setDays((p) => p.map((d, i) =>
      i !== dayIdx ? d : {
        ...d,
        exercises: d.exercises.filter((_, ei) => ei !== exIdx).map((e, ei) => ({ ...e, order_index: ei })),
      }
    ));
  }

  function updateDayEx(dayIdx: number, exIdx: number, patch: { target_sets?: string; target_reps?: string }) {
    setDays((p) => p.map((d, i) =>
      i !== dayIdx ? d : {
        ...d,
        exercises: d.exercises.map((e, ei) => ei === exIdx ? { ...e, ...patch } : e),
      }
    ));
  }

  async function handleSave() {
    if (!name.trim() || days.length === 0) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        days: days.map((d) => ({
          day_number: d.day_number,
          name: d.name,
          exercises: d.exercises.map((e) => ({
            exercise_name: e.exercise_name,
            exercise_id: e.exercise_id,
            order_index: e.order_index,
            target_sets: e.target_sets ? parseInt(e.target_sets) : undefined,
            target_reps: e.target_reps || undefined,
          })),
        })),
      };
      let res;
      if (isEdit) {
        res = await api.put(`/api/v1/user-programs/${program!.id}`, payload);
      } else {
        res = await api.post("/api/v1/user-programs", payload);
      }
      onSaved(res.data);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="relative bg-background w-full sm:max-w-2xl sm:rounded-xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b shrink-0">
          <LayoutList className="h-5 w-5 text-primary" />
          <span className="font-semibold text-base flex-1">
            {isEdit ? t("editProgram") : t("createProgram")}
          </span>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted">
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div className="space-y-1.5">
            <Label>{t("programName")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("programName")} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("programDescription")}</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("programDescription")} />
          </div>

          {/* Days */}
          <div className="space-y-3">
            {days.map((d, dayIdx) => (
              <div key={dayIdx} className="rounded-lg border bg-muted/20 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 bg-muted/40">
                  <span className="text-xs font-bold text-muted-foreground w-5">{dayIdx + 1}</span>
                  <Input
                    value={d.name}
                    onChange={(e) => setDays((p) => p.map((x, i) => i === dayIdx ? { ...x, name: e.target.value } : x))}
                    className="h-7 text-sm font-medium flex-1"
                    placeholder={t("dayName")}
                  />
                  <button
                    onClick={() => removeDay(dayIdx)}
                    className="p-1 rounded hover:bg-muted text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="px-3 pb-3 pt-1 space-y-1.5">
                  {d.exercises.map((ex, exIdx) => (
                    <div key={exIdx} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4 shrink-0">{exIdx + 1}</span>
                      <span className="flex-1 text-sm truncate font-medium">{ex.exercise_name}</span>
                      <Input
                        type="number"
                        min="1"
                        max="20"
                        placeholder={t("targetSets")}
                        value={ex.target_sets}
                        onChange={(e) => updateDayEx(dayIdx, exIdx, { target_sets: e.target.value })}
                        className="h-7 w-14 text-xs px-1.5"
                        title={t("targetSets")}
                      />
                      <span className="text-xs text-muted-foreground">×</span>
                      <Input
                        placeholder={t("targetReps")}
                        value={ex.target_reps}
                        onChange={(e) => updateDayEx(dayIdx, exIdx, { target_reps: e.target.value })}
                        className="h-7 w-16 text-xs px-1.5"
                        title={t("targetReps")}
                      />
                      <button
                        onClick={() => removeExFromDay(dayIdx, exIdx)}
                        className="p-0.5 rounded hover:bg-muted text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}

                  <button
                    onClick={() => { setPickerDayIdx(dayIdx); setPickerOpen(true); }}
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-1"
                  >
                    <Plus className="h-3 w-3" />
                    {t("addExercise")}
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={addDay}
              className="w-full py-2.5 rounded-lg border-2 border-dashed border-border hover:border-primary hover:text-primary transition-colors text-sm text-muted-foreground flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              {t("addDay")}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 pt-2 border-t shrink-0 flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">{t("backToSession")}</Button>
          <Button
            onClick={handleSave}
            disabled={saving || !name.trim() || days.length === 0}
            className="flex-1"
          >
            {saving ? "..." : t("saveProgram")}
          </Button>
        </div>
      </div>

      {pickerOpen && pickerDayIdx !== null && (
        <ExercisePickerModal
          locale={locale}
          onSelect={(ex) => {
            addExToDay(pickerDayIdx, ex);
            setPickerOpen(false);
            setPickerDayIdx(null);
          }}
          onClose={() => { setPickerOpen(false); setPickerDayIdx(null); }}
        />
      )}
    </div>
  );
}

// ── Exercise Block ─────────────────────────────────────────────────────────

function ExerciseBlock({
  ex, exIdx, t,
  onOpenPicker, onCollapse, onRemove,
  onUpdateName, onUpdateNotes,
  onAddSet, onUpdateSet, onRemoveSet,
}: {
  ex: ExRow;
  exIdx: number;
  t: ReturnType<typeof useTranslations<"workouts">>;
  onOpenPicker: () => void;
  onCollapse: () => void;
  onRemove: () => void;
  onUpdateName: (v: string) => void;
  onUpdateNotes: (v: string) => void;
  onAddSet: (type: SetType) => void;
  onUpdateSet: (uid: string, patch: Partial<SetRow>) => void;
  onRemoveSet: (uid: string) => void;
}) {
  const warmupCount = ex.sets.filter((s) => s.set_type === "warmup").length;
  const workingCount = ex.sets.filter((s) => s.set_type === "working").length;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/30">
        <span className="text-xs font-bold text-muted-foreground w-5">{exIdx + 1}</span>
        <div className="flex-1 flex gap-1.5 min-w-0">
          <Input
            placeholder={t("exerciseName")}
            value={ex.exercise_name}
            onChange={(e) => onUpdateName(e.target.value)}
            className="h-8 text-sm font-medium flex-1 min-w-0"
          />
          <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={onOpenPicker} title={t("pickExercise")}>
            <BookOpen className="h-3.5 w-3.5" />
          </Button>
        </div>
        {ex.exercise_id && <span className="text-primary"><BookOpen className="h-3 w-3" /></span>}
        <button type="button" onClick={onCollapse} className="p-1 rounded hover:bg-muted">
          {ex.collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
        <button type="button" onClick={onRemove} className="p-1 rounded hover:bg-muted text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {!ex.collapsed && (
        <div className="px-3 pb-3 space-y-2 pt-2">
          {/* Sets table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left py-1 pr-2 w-6">#</th>
                  <th className="text-left py-1 pr-2 w-16">{t("setType")}</th>
                  <th className="text-left py-1 pr-2">{t("weight")} kg</th>
                  <th className="text-left py-1 pr-2">{t("reps")}</th>
                  <th className="text-left py-1 pr-2 w-12">RPE</th>
                  <th className="w-6"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {ex.sets.map((s, si) => (
                  <SetRow
                    key={s.uid}
                    s={s}
                    si={si}
                    t={t}
                    onChange={(patch) => onUpdateSet(s.uid, patch)}
                    onRemove={() => onRemoveSet(s.uid)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Badge summary */}
          {(warmupCount > 0 || workingCount > 0) && (
            <div className="flex gap-2 text-xs">
              {warmupCount > 0 && <span className="px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">{warmupCount} warmup</span>}
              {workingCount > 0 && <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">{workingCount} working</span>}
            </div>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs px-2.5" onClick={() => onAddSet("warmup")}>
              + {t("addWarmup")}
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs px-2.5" onClick={() => onAddSet("working")}>
              + {t("addSet")}
            </Button>
          </div>

          <div>
            <Input
              placeholder={t("exerciseNotes")}
              value={ex.notes}
              onChange={(e) => onUpdateNotes(e.target.value)}
              className="h-7 text-xs"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Set Row ─────────────────────────────────────────────────────────────────

function SetRow({
  s, si, t, onChange, onRemove,
}: {
  s: SetRow;
  si: number;
  t: ReturnType<typeof useTranslations<"workouts">>;
  onChange: (patch: Partial<SetRow>) => void;
  onRemove: () => void;
}) {
  const isWarmup = s.set_type === "warmup";
  return (
    <tr className={isWarmup ? "text-yellow-600 dark:text-yellow-400" : ""}>
      <td className="py-1.5 pr-2 font-medium">{si + 1}</td>
      <td className="py-1.5 pr-2">
        <button
          type="button"
          onClick={() => onChange({ set_type: isWarmup ? "working" : "warmup" })}
          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
            isWarmup
              ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
              : "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
          }`}
          title={t("toggleSetType")}
        >
          {isWarmup ? "W" : t("setWorking")}
        </button>
      </td>
      <td className="py-1.5 pr-2">
        <Input
          type="number"
          step="0.5"
          min="0"
          placeholder="—"
          value={s.weight_kg}
          onChange={(e) => onChange({ weight_kg: e.target.value })}
          className="h-7 w-16 text-xs px-1.5"
        />
      </td>
      <td className="py-1.5 pr-2">
        <Input
          type="number"
          min="1"
          placeholder="—"
          value={s.reps}
          onChange={(e) => onChange({ reps: e.target.value })}
          className="h-7 w-14 text-xs px-1.5"
        />
      </td>
      <td className="py-1.5 pr-2">
        <Input
          type="number"
          step="0.5"
          min="1"
          max="10"
          placeholder="—"
          value={s.rpe}
          onChange={(e) => onChange({ rpe: e.target.value })}
          className="h-7 w-12 text-xs px-1.5"
        />
      </td>
      <td className="py-1.5">
        <button type="button" onClick={onRemove} className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive">
          <Trash2 className="h-3 w-3" />
        </button>
      </td>
    </tr>
  );
}

// ── Workout History Card ──────────────────────────────────────────────────────

const TYPE_ICONS: Record<string, React.ElementType> = {
  strength: Dumbbell, cardio: Flame, running: Route,
  cycling: Activity, pilates: Zap, crossfit: Timer,
};

function WorkoutCard({
  workout, locale, deleting, onDelete, t,
}: {
  workout: Workout;
  locale: string;
  deleting: boolean;
  onDelete: () => void;
  t: ReturnType<typeof useTranslations<"workouts">>;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = TYPE_ICONS[workout.workout_type] ?? Dumbbell;

  const dateStr = new Date(workout.logged_at).toLocaleDateString(
    locale === "tr" ? "tr-TR" : "en-US",
    { year: "numeric", month: "short", day: "numeric" }
  );

  return (
    <div className="py-3">
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary shrink-0" />
            <p className="font-semibold truncate">{workout.name}</p>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
            <span>{dateStr}</span>
            {workout.duration_minutes && <span>{workout.duration_minutes} {t("min")}</span>}
            {workout.distance_km && <span>{workout.distance_km} km</span>}
            {workout.total_volume_kg != null && workout.total_volume_kg > 0 && (
              <span>{workout.total_volume_kg.toLocaleString()} kg {t("volume")}</span>
            )}
            {workout.total_sets != null && workout.total_sets > 0 && (
              <span>{workout.total_sets} {t("sets")} · {workout.total_reps} {t("reps")}</span>
            )}
            {workout.calories_burned && <span>{workout.calories_burned} kcal</span>}
            {workout.avg_heart_rate && <span>{workout.avg_heart_rate} bpm</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          {workout.exercises.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((p) => !p)}
              className="p-1 rounded hover:bg-muted"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
          <Button
            variant="ghost" size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            disabled={deleting}
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {workout.notes && <p className="text-xs text-muted-foreground italic mt-1">{workout.notes}</p>}

      {expanded && workout.exercises.length > 0 && (
        <div className="mt-2 space-y-2">
          {workout.exercises.map((ex) => (
            <div key={ex.id} className="rounded-md border bg-muted/20 overflow-hidden">
              <div className="px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 border-b border-border/50">
                {ex.exercise_id && <BookOpen className="h-3 w-3 text-primary" />}
                {ex.exercise_name}
              </div>
              {ex.workout_sets.length > 0 ? (
                <table className="w-full text-xs px-3">
                  <tbody>
                    {ex.workout_sets.map((s) => (
                      <tr key={s.id} className={`border-b border-border/30 last:border-0 ${s.set_type === "warmup" ? "text-yellow-600 dark:text-yellow-400" : ""}`}>
                        <td className="py-1 pl-3 w-6 font-medium">{s.set_number}</td>
                        <td className="py-1 w-14 text-muted-foreground">{s.set_type === "warmup" ? "warmup" : "working"}</td>
                        <td className="py-1">
                          {s.weight_kg != null && s.reps != null
                            ? <span className="font-medium">{s.weight_kg}kg × {s.reps}</span>
                            : s.reps != null ? <span>{s.reps} reps</span>
                            : s.duration_seconds != null ? <span>{Math.round(s.duration_seconds / 60)}min</span>
                            : "—"}
                        </td>
                        {s.rpe != null && (
                          <td className="py-1 pr-3 text-right text-muted-foreground">RPE {s.rpe}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                ex.sets != null && ex.reps != null && (
                  <p className="text-xs px-3 py-1.5 text-muted-foreground">
                    {ex.sets}×{ex.reps}{ex.weight_kg ? ` @ ${ex.weight_kg}kg` : ""}
                  </p>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
