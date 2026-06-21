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
import { WorkoutSession } from "@/components/workouts/WorkoutSession";
import { api } from "@/lib/api";
import { todayISO, localeDateToISO } from "@/lib/utils";
import type { Exercise, Workout, WorkoutAnalytics, WorkoutType, SetType } from "@/types";
import {
  Dumbbell, Plus, Trash2, BookOpen, ChevronDown, ChevronUp,
  Flame, Route, Timer, Heart, Zap, Activity,
} from "lucide-react";

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

  const isCardio = WORKOUT_TYPES.find((t) => t.value === workoutType)?.isCardio ?? false;

  const fetchAll = () =>
    Promise.all([
      api.get("/api/v1/workouts").then((r) => setWorkouts(r.data)),
      api.get("/api/v1/analytics/workout-analytics").then((r) => setAnalytics(r.data)),
      api.get("/api/v1/analytics/workout-frequency?days=30").then((r) => setFreqData(r.data)),
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

  function handlePickerSelect(ex: Exercise) {
    if (pickerTarget === null) {
      setExercises((p) => [...p, { ...emptyExercise(), exercise_name: ex.name, exercise_id: ex.id }]);
    } else {
      updateExercise(pickerTarget, { exercise_name: ex.name, exercise_id: ex.id });
    }
    setPickerOpen(false);
    setPickerTarget(null);
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
              <Button onClick={() => setSessionOpen(true)} className="shrink-0">
                {t("startNow")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Log Form ── */}
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
          onClose={() => setSessionOpen(false)}
          onSaved={() => { setSessionOpen(false); fetchAll(); }}
        />
      )}
    </AppLayout>
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
