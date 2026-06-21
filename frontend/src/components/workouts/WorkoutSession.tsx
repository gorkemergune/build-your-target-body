"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  X, Plus, Check, SkipForward, Dumbbell, Flame, Route,
  Activity, Zap, Timer, BookOpen, Trash2, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExercisePickerModal } from "@/components/workouts/ExercisePickerModal";
import { api } from "@/lib/api";
import type { Exercise, SetType, WorkoutType } from "@/types";

// ── Types ──────────────────────────────────────────────────────────────────────

interface LiveSet {
  uid: string;
  set_type: SetType;
  weight_kg: string;
  reps: string;
  rpe: string;
  done: boolean;
}

interface LiveExercise {
  uid: string;
  exercise_name: string;
  exercise_id: number | null;
  sets: LiveSet[];
  collapsed: boolean;
}

function genUid() { return Math.random().toString(36).slice(2); }

function emptySet(type: SetType = "working"): LiveSet {
  return { uid: genUid(), set_type: type, weight_kg: "", reps: "", rpe: "", done: false };
}

function emptyExercise(name = "", id: number | null = null): LiveExercise {
  return { uid: genUid(), exercise_name: name, exercise_id: id, sets: [emptySet(), emptySet(), emptySet()], collapsed: false };
}

const WORKOUT_TYPES: { value: WorkoutType; icon: React.ElementType }[] = [
  { value: "strength", icon: Dumbbell },
  { value: "cardio", icon: Flame },
  { value: "running", icon: Route },
  { value: "cycling", icon: Activity },
  { value: "pilates", icon: Zap },
  { value: "crossfit", icon: Timer },
];

const REST_OPTIONS = [60, 90, 120];

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtElapsed(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function calcVolume(exercises: LiveExercise[]) {
  let vol = 0, sets = 0, reps = 0;
  for (const ex of exercises) {
    for (const s of ex.sets) {
      if (s.done && s.set_type === "working") {
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

// ── Main Component ─────────────────────────────────────────────────────────────

interface Props {
  locale: string;
  onClose: () => void;
  onSaved: () => void;
}

export function WorkoutSession({ locale, onClose, onSaved }: Props) {
  const t = useTranslations("workouts");

  const [phase, setPhase] = useState<"session" | "summary">("session");
  const [workoutName, setWorkoutName] = useState("My Workout");
  const [workoutType, setWorkoutType] = useState<WorkoutType>("strength");
  const [restDuration, setRestDuration] = useState(90);
  const [restEnabled, setRestEnabled] = useState(true);
  const [exercises, setExercises] = useState<LiveExercise[]>([]);

  // Timers
  const elapsedRef = useRef(0);
  const [elapsedDisplay, setElapsedDisplay] = useState(0);
  const restRef = useRef(0);
  const [restDisplay, setRestDisplay] = useState(0);
  const [restActive, setRestActive] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Saving
  useEffect(() => {
    tickRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsedDisplay(elapsedRef.current);

      if (restRef.current > 0) {
        restRef.current -= 1;
        setRestDisplay(restRef.current);
        if (restRef.current === 0) {
          setRestActive(false);
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
          }
        }
      }
    }, 1000);

    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  function startRest() {
    if (!restEnabled) return;
    restRef.current = restDuration;
    setRestDisplay(restDuration);
    setRestActive(true);
  }

  function skipRest() {
    restRef.current = 0;
    setRestDisplay(0);
    setRestActive(false);
  }

  // Confirm close during active session
  function handleClose() {
    if (exercises.some((ex) => ex.sets.some((s) => s.done))) {
      if (!confirm(t("confirmAbandon"))) return;
    }
    onClose();
  }

  // ── Exercise ops ──

  function addExercise(name = "", id: number | null = null) {
    setExercises((p) => [...p, emptyExercise(name, id)]);
  }

  function removeExercise(uid: string) {
    setExercises((p) => p.filter((e) => e.uid !== uid));
  }

  function toggleCollapse(uid: string) {
    setExercises((p) => p.map((e) => e.uid === uid ? { ...e, collapsed: !e.collapsed } : e));
  }

  function addSetToExercise(exUid: string, type: SetType) {
    setExercises((p) =>
      p.map((e) => e.uid === exUid ? { ...e, sets: [...e.sets, emptySet(type)] } : e)
    );
  }

  function removeSetFromExercise(exUid: string, setUid: string) {
    setExercises((p) =>
      p.map((e) => e.uid === exUid ? { ...e, sets: e.sets.filter((s) => s.uid !== setUid) } : e)
    );
  }

  function updateSet(exUid: string, setUid: string, patch: Partial<LiveSet>) {
    setExercises((p) =>
      p.map((e) =>
        e.uid === exUid
          ? { ...e, sets: e.sets.map((s) => s.uid === setUid ? { ...s, ...patch } : s) }
          : e
      )
    );
  }

  function markSetDone(exUid: string, setUid: string) {
    setExercises((p) =>
      p.map((e) =>
        e.uid === exUid
          ? { ...e, sets: e.sets.map((s) => s.uid === setUid ? { ...s, done: true } : s) }
          : e
      )
    );
    startRest();
  }

  // ── Exercise picker ──

  function handlePickerSelect(ex: Exercise) {
    addExercise(ex.name, ex.id);
    setPickerOpen(false);
  }

  // ── Save ──

  async function saveSession() {
    setSaving(true);
    try {
      const durationMinutes = Math.max(1, Math.round(elapsedRef.current / 60));
      const exPayload = exercises
        .filter((ex) => ex.exercise_name.trim() && ex.sets.some((s) => s.done))
        .map((ex, i) => ({
          exercise_name: ex.exercise_name.trim(),
          exercise_id: ex.exercise_id,
          order_index: i,
          sets_data: ex.sets
            .filter((s) => s.done)
            .map((s, si) => ({
              set_number: si + 1,
              set_type: s.set_type,
              reps: s.reps ? parseInt(s.reps) : undefined,
              weight_kg: s.weight_kg ? parseFloat(s.weight_kg) : undefined,
              rpe: s.rpe ? parseFloat(s.rpe) : undefined,
            })),
        }));

      await api.post("/api/v1/workouts", {
        name: workoutName.trim() || "Workout",
        workout_type: workoutType,
        duration_minutes: durationMinutes,
        exercises: exPayload,
      });

      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const summary = calcVolume(exercises);
  const completedExercises = exercises.filter((e) => e.sets.some((s) => s.done)).length;

  const restPct = restEnabled && restDuration > 0
    ? Math.round(((restDuration - restDisplay) / restDuration) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-background/95 backdrop-blur shrink-0">
        <button onClick={handleClose} className="p-1.5 rounded-md hover:bg-muted">
          <X className="h-5 w-5" />
        </button>

        <input
          value={workoutName}
          onChange={(e) => setWorkoutName(e.target.value)}
          className="flex-1 bg-transparent font-semibold text-base outline-none truncate min-w-0"
          placeholder={t("workoutName")}
        />

        <div className="font-mono text-lg font-bold tabular-nums text-primary shrink-0">
          {fmtElapsed(elapsedDisplay)}
        </div>

        <Button
          size="sm"
          onClick={() => setPhase("summary")}
          disabled={exercises.length === 0}
          className="shrink-0"
        >
          {t("finish")}
        </Button>
      </div>

      {/* ── Config bar ── */}
      <div className="px-4 py-2 border-b bg-muted/20 flex items-center gap-3 shrink-0 overflow-x-auto">
        {/* Workout type */}
        <div className="flex gap-1 shrink-0">
          {WORKOUT_TYPES.map(({ value, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setWorkoutType(value)}
              className={`p-1.5 rounded-md transition-colors ${
                workoutType === value
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground"
              }`}
              title={t(`type${value.charAt(0).toUpperCase() + value.slice(1)}` as any)}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-border shrink-0" />

        {/* Rest duration */}
        <span className="text-xs text-muted-foreground shrink-0">{t("autoRest")}:</span>
        <div className="flex gap-1 shrink-0">
          {REST_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => { setRestDuration(s); setRestEnabled(true); }}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                restEnabled && restDuration === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              }`}
            >
              {s}s
            </button>
          ))}
          <button
            onClick={() => setRestEnabled(false)}
            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
              !restEnabled
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            }`}
          >
            {t("off")}
          </button>
        </div>

        {/* Live stats */}
        {summary.sets > 0 && (
          <>
            <div className="w-px h-5 bg-border shrink-0" />
            <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
              {summary.sets}s · {summary.reps}r · {summary.vol > 0 ? `${summary.vol.toLocaleString()}kg` : ""}
            </span>
          </>
        )}
      </div>

      {/* ── Body: exercises ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {exercises.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <Dumbbell className="h-12 w-12 opacity-20" />
            <p className="text-sm">{t("addFirstExercise")}</p>
          </div>
        )}

        {exercises.map((ex, exIdx) => (
          <SessionExerciseBlock
            key={ex.uid}
            ex={ex}
            exIdx={exIdx}
            t={t}
            onPickerOpen={() => setPickerOpen(true)}
            onCollapse={() => toggleCollapse(ex.uid)}
            onRemove={() => removeExercise(ex.uid)}
            onAddSet={(type) => addSetToExercise(ex.uid, type)}
            onRemoveSet={(su) => removeSetFromExercise(ex.uid, su)}
            onUpdateSet={(su, patch) => updateSet(ex.uid, su, patch)}
            onMarkDone={(su) => markSetDone(ex.uid, su)}
          />
        ))}

        <button
          onClick={() => setPickerOpen(true)}
          className="w-full py-3 rounded-lg border-2 border-dashed border-border hover:border-primary hover:text-primary transition-colors text-sm text-muted-foreground flex items-center justify-center gap-2"
        >
          <Plus className="h-4 w-4" />
          {t("addExercise")}
        </button>
      </div>

      {/* ── Rest Timer Bar ── */}
      {restActive && (
        <div className="shrink-0 border-t bg-primary text-primary-foreground">
          <div className="relative h-1.5 bg-primary-foreground/20 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-primary-foreground/60 transition-all duration-1000"
              style={{ width: `${restPct}%` }}
            />
          </div>
          <div className="flex items-center gap-4 px-4 py-3">
            <span className="text-sm font-medium">{t("restTimer")}</span>
            <span className="font-mono text-2xl font-bold tabular-nums flex-1 text-center">
              {fmtElapsed(restDisplay)}
            </span>
            <button
              onClick={skipRest}
              className="flex items-center gap-1.5 text-sm font-medium opacity-80 hover:opacity-100"
            >
              <SkipForward className="h-4 w-4" />
              {t("skip")}
            </button>
          </div>
        </div>
      )}

      {/* ── Summary Modal ── */}
      {phase === "summary" && (
        <SessionSummary
          workoutName={workoutName}
          workoutType={workoutType}
          elapsed={elapsedRef.current}
          summary={summary}
          completedExercises={completedExercises}
          saving={saving}
          t={t}
          onBack={() => setPhase("session")}
          onSave={saveSession}
        />
      )}

      {pickerOpen && (
        <ExercisePickerModal
          locale={locale}
          onSelect={handlePickerSelect}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

// ── Session Exercise Block ─────────────────────────────────────────────────────

function SessionExerciseBlock({
  ex, exIdx, t,
  onPickerOpen, onCollapse, onRemove,
  onAddSet, onRemoveSet, onUpdateSet, onMarkDone,
}: {
  ex: LiveExercise;
  exIdx: number;
  t: ReturnType<typeof useTranslations<"workouts">>;
  onPickerOpen: () => void;
  onCollapse: () => void;
  onRemove: () => void;
  onAddSet: (type: SetType) => void;
  onRemoveSet: (uid: string) => void;
  onUpdateSet: (uid: string, patch: Partial<LiveSet>) => void;
  onMarkDone: (uid: string) => void;
}) {
  const doneCount = ex.sets.filter((s) => s.done).length;
  const totalCount = ex.sets.length;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Exercise header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/30">
        <span className="w-5 text-xs font-bold text-muted-foreground">{exIdx + 1}</span>
        {ex.exercise_name ? (
          <span className="flex-1 font-semibold text-sm truncate flex items-center gap-1.5">
            {ex.exercise_id && <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />}
            {ex.exercise_name}
          </span>
        ) : (
          <button
            onClick={onPickerOpen}
            className="flex-1 text-left text-sm text-muted-foreground flex items-center gap-1.5 hover:text-primary"
          >
            <BookOpen className="h-3.5 w-3.5" />
            {t("pickExercise")}
          </button>
        )}
        {totalCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {doneCount}/{totalCount}
          </span>
        )}
        <button onClick={onCollapse} className="p-1 hover:bg-muted rounded">
          {ex.collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
        <button onClick={onRemove} className="p-1 hover:bg-muted rounded text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {!ex.collapsed && (
        <div className="px-3 pb-3 pt-1 space-y-1.5">
          {/* Column headers */}
          <div className="grid grid-cols-[28px_42px_1fr_1fr_56px_36px] gap-1.5 text-xs text-muted-foreground px-1">
            <span>#</span>
            <span>{t("setType")}</span>
            <span>{t("weight")} kg</span>
            <span>{t("reps")}</span>
            <span>RPE</span>
            <span />
          </div>

          {ex.sets.map((s, si) => (
            <SessionSetRow
              key={s.uid}
              s={s}
              si={si}
              t={t}
              onChange={(patch) => onUpdateSet(s.uid, patch)}
              onRemove={() => onRemoveSet(s.uid)}
              onDone={() => onMarkDone(s.uid)}
            />
          ))}

          <div className="flex gap-1.5 pt-1">
            <button
              onClick={() => onAddSet("warmup")}
              className="px-2.5 py-1 rounded-md text-xs bg-muted hover:bg-muted/80 text-muted-foreground"
            >
              + {t("addWarmup")}
            </button>
            <button
              onClick={() => onAddSet("working")}
              className="px-2.5 py-1 rounded-md text-xs bg-muted hover:bg-muted/80 text-muted-foreground"
            >
              + {t("addSet")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Session Set Row ────────────────────────────────────────────────────────────

function SessionSetRow({
  s, si, t, onChange, onRemove, onDone,
}: {
  s: LiveSet;
  si: number;
  t: ReturnType<typeof useTranslations<"workouts">>;
  onChange: (patch: Partial<LiveSet>) => void;
  onRemove: () => void;
  onDone: () => void;
}) {
  const isWarmup = s.set_type === "warmup";

  if (s.done) {
    return (
      <div className="grid grid-cols-[28px_42px_1fr_1fr_56px_36px] gap-1.5 items-center opacity-50">
        <span className="text-xs font-medium text-center">{si + 1}</span>
        <span className={`text-xs text-center ${isWarmup ? "text-yellow-600" : "text-blue-600"}`}>
          {isWarmup ? "W" : t("setWorking")}
        </span>
        <span className="text-xs text-center">{s.weight_kg || "—"}</span>
        <span className="text-xs text-center">{s.reps || "—"}</span>
        <span className="text-xs text-center">{s.rpe || "—"}</span>
        <div className="flex justify-center">
          <Check className="h-4 w-4 text-green-500" />
        </div>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-[28px_42px_1fr_1fr_56px_36px] gap-1.5 items-center ${isWarmup ? "text-yellow-600" : ""}`}>
      <span className="text-xs font-medium text-center">{si + 1}</span>
      <button
        onClick={() => onChange({ set_type: isWarmup ? "working" : "warmup" })}
        className={`text-xs text-center py-0.5 rounded ${
          isWarmup
            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
            : "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
        }`}
      >
        {isWarmup ? "W" : t("setWorking")}
      </button>
      <Input
        type="number"
        step="0.5"
        min="0"
        placeholder="—"
        value={s.weight_kg}
        onChange={(e) => onChange({ weight_kg: e.target.value })}
        className="h-9 text-sm text-center px-1"
      />
      <Input
        type="number"
        min="1"
        placeholder="—"
        value={s.reps}
        onChange={(e) => onChange({ reps: e.target.value })}
        className="h-9 text-sm text-center px-1"
      />
      <Input
        type="number"
        step="0.5"
        min="1"
        max="10"
        placeholder="—"
        value={s.rpe}
        onChange={(e) => onChange({ rpe: e.target.value })}
        className="h-9 text-sm text-center px-1"
      />
      <button
        onClick={onDone}
        className="h-9 w-full flex items-center justify-center rounded-md bg-green-500 hover:bg-green-600 text-white transition-colors"
        title={t("setDone")}
      >
        <Check className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── Session Summary ────────────────────────────────────────────────────────────

function SessionSummary({
  workoutName, workoutType, elapsed, summary, completedExercises,
  saving, t, onBack, onSave,
}: {
  workoutName: string;
  workoutType: WorkoutType;
  elapsed: number;
  summary: { vol: number; sets: number; reps: number };
  completedExercises: number;
  saving: boolean;
  t: ReturnType<typeof useTranslations<"workouts">>;
  onBack: () => void;
  onSave: () => void;
}) {
  const typeIconMap: Record<string, React.ElementType> = {
    strength: Dumbbell, cardio: Flame, running: Route,
    cycling: Activity, pilates: Zap, crossfit: Timer,
  };
  const TypeIcon = typeIconMap[workoutType] ?? Dumbbell;

  return (
    <div className="absolute inset-0 z-10 bg-background flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b">
        <button onClick={onBack} className="p-1.5 rounded-md hover:bg-muted">
          <X className="h-5 w-5" />
        </button>
        <span className="font-semibold text-base flex-1">{t("sessionSummary")}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <TypeIcon className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold">{workoutName || t("workoutName")}</h2>
          <span className="text-sm text-muted-foreground capitalize">{workoutType}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <SummaryStatCard label={t("sessionDuration")} value={fmtElapsed(elapsed)} />
          <SummaryStatCard label={t("exercisesCompleted")} value={String(completedExercises)} />
          <SummaryStatCard label={t("setsCompleted")} value={String(summary.sets)} />
          <SummaryStatCard label={t("repsCompleted")} value={String(summary.reps)} />
          {summary.vol > 0 && (
            <SummaryStatCard
              label={t("sessionVolume")}
              value={`${summary.vol.toLocaleString()} kg`}
              wide
            />
          )}
        </div>
      </div>

      <div className="px-4 pb-6 pt-2 flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          {t("backToSession")}
        </Button>
        <Button onClick={onSave} disabled={saving} className="flex-1">
          {saving ? "..." : t("saveSession")}
        </Button>
      </div>
    </div>
  );
}

function SummaryStatCard({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-xl border bg-muted/30 p-4 text-center ${wide ? "col-span-2" : ""}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
