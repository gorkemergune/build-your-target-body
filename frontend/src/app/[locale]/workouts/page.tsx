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
import { api } from "@/lib/api";
import { todayISO, localeDateToISO } from "@/lib/utils";
import type { Workout, WorkoutAnalytics } from "@/types";
import { Dumbbell, Plus, Trash2 } from "lucide-react";

interface ExerciseRow {
  exercise_name: string;
  sets: string;
  reps: string;
  weight_kg: string;
  notes: string;
}

export default function WorkoutsPage({ params: { locale } }: { params: { locale: string } }) {
  const t = useTranslations("workouts");
  const tc = useTranslations("common");

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [analytics, setAnalytics] = useState<WorkoutAnalytics | null>(null);
  const [frequencyData, setFrequencyData] = useState<{ date: string; value: number }[]>([]);

  // Form state
  const [name, setName] = useState("");
  const [date, setDate] = useState(todayISO());
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const fetchAll = () =>
    Promise.all([
      api.get("/api/v1/workouts").then((r) => setWorkouts(r.data)),
      api.get("/api/v1/analytics/workout-analytics").then((r) => setAnalytics(r.data)),
      api.get("/api/v1/analytics/workout-frequency?days=30").then((r) => setFrequencyData(r.data)),
    ]);

  useEffect(() => { fetchAll(); }, []);

  function addExercise() {
    setExercises((prev) => [...prev, { exercise_name: "", sets: "", reps: "", weight_kg: "", notes: "" }]);
  }

  function updateExercise(i: number, field: keyof ExerciseRow, value: string) {
    setExercises((prev) => prev.map((ex, idx) => idx === i ? { ...ex, [field]: value } : ex));
  }

  function removeExercise(i: number) {
    setExercises((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/api/v1/workouts", {
        name: name.trim(),
        logged_at: localeDateToISO(date),
        duration_minutes: duration ? parseInt(duration) : undefined,
        notes: notes.trim() || undefined,
        exercises: exercises
          .filter((ex) => ex.exercise_name.trim())
          .map((ex) => ({
            exercise_name: ex.exercise_name.trim(),
            sets: ex.sets ? parseInt(ex.sets) : undefined,
            reps: ex.reps ? parseInt(ex.reps) : undefined,
            weight_kg: ex.weight_kg ? parseFloat(ex.weight_kg) : undefined,
            notes: ex.notes.trim() || undefined,
          })),
      });
      setName(""); setDate(todayISO()); setDuration(""); setNotes(""); setExercises([]);
      fetchAll();
    } finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm(tc("deleteConfirm"))) return;
    setDeleting(id);
    try {
      await api.delete(`/api/v1/workouts/${id}`);
      fetchAll();
    } finally { setDeleting(null); }
  }

  const statItems = analytics
    ? [
        { label: t("thisWeek"), value: String(analytics.workouts_this_week) },
        { label: t("thisMonth"), value: String(analytics.workouts_this_month) },
        { label: t("avgDuration"), value: analytics.avg_duration_minutes != null ? `${analytics.avg_duration_minutes} ${t("min")}` : "—" },
        { label: t("totalVolume"), value: analytics.total_volume_kg > 0 ? `${analytics.total_volume_kg.toLocaleString()} ${t("kg")}` : "—" },
      ]
    : [];

  return (
    <AppLayout locale={locale}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{t("title")}</h1>

        {/* Analytics stats */}
        {analytics && <StatsBar stats={statItems} />}

        {/* Frequency chart */}
        <Card>
          <CardHeader><CardTitle className="text-base">{t("frequencyChart")}</CardTitle></CardHeader>
          <CardContent>
            <FrequencyChart data={frequencyData} />
          </CardContent>
        </Card>

        {/* Log form */}
        <Card>
          <CardHeader><CardTitle>{t("logWorkout")}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-2 sm:col-span-1">
                  <Label>{t("workoutName")}</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>{t("date")}</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>{t("duration")}</Label>
                  <Input type="number" min="1" max="600" value={duration} onChange={(e) => setDuration(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("notes")}</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              {/* Exercise rows */}
              {exercises.length > 0 && (
                <div className="space-y-2">
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-1 text-xs text-muted-foreground px-1">
                    <span className="col-span-4">{t("exerciseName")}</span>
                    <span className="col-span-2">{t("sets")}</span>
                    <span className="col-span-2">{t("reps")}</span>
                    <span className="col-span-3">{t("weight")}</span>
                  </div>
                  {exercises.map((ex, i) => (
                    <div key={i} className="grid grid-cols-12 gap-1 items-center">
                      <Input
                        placeholder={t("exerciseName")}
                        value={ex.exercise_name}
                        onChange={(e) => updateExercise(i, "exercise_name", e.target.value)}
                        className="col-span-4 text-sm h-8"
                      />
                      <Input
                        placeholder="—"
                        type="number" min="1"
                        value={ex.sets}
                        onChange={(e) => updateExercise(i, "sets", e.target.value)}
                        className="col-span-2 text-sm h-8"
                      />
                      <Input
                        placeholder="—"
                        type="number" min="1"
                        value={ex.reps}
                        onChange={(e) => updateExercise(i, "reps", e.target.value)}
                        className="col-span-2 text-sm h-8"
                      />
                      <Input
                        placeholder="0"
                        type="number" step="0.5" min="0"
                        value={ex.weight_kg}
                        onChange={(e) => updateExercise(i, "weight_kg", e.target.value)}
                        className="col-span-3 text-sm h-8"
                      />
                      <Button
                        type="button" variant="ghost" size="icon"
                        className="h-8 w-8 col-span-1 text-destructive hover:text-destructive"
                        onClick={() => removeExercise(i)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={addExercise} className="flex-1">
                  <Plus className="h-4 w-4 mr-2" />{t("addExercise")}
                </Button>
                <Button type="submit" disabled={saving} className="flex-1">
                  {saving ? "..." : t("logWorkout")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Workout history */}
        <Card>
          <CardHeader><CardTitle>{t("history")}</CardTitle></CardHeader>
          <CardContent>
            {workouts.length === 0 ? (
              <EmptyState
                icon={Dumbbell}
                title={t("emptyTitle")}
                description={t("emptyDescription")}
              />
            ) : (
              <div className="divide-y">
                {workouts.map((w) => (
                  <WorkoutCard
                    key={w.id}
                    workout={w}
                    locale={locale}
                    deleting={deleting === w.id}
                    onDelete={() => handleDelete(w.id)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function WorkoutCard({
  workout,
  locale,
  deleting,
  onDelete,
}: {
  workout: Workout;
  locale: string;
  deleting: boolean;
  onDelete: () => void;
}) {
  const volume = workout.exercises.reduce((sum, ex) => {
    if (ex.sets && ex.reps && ex.weight_kg) return sum + ex.sets * ex.reps * ex.weight_kg;
    return sum;
  }, 0);

  return (
    <div className="py-4">
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="font-semibold">{workout.name}</p>
          <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
            <span>
              {new Date(workout.logged_at).toLocaleDateString(
                locale === "tr" ? "tr-TR" : "en-US",
                { year: "numeric", month: "short", day: "numeric" }
              )}
            </span>
            {workout.duration_minutes && <span>{workout.duration_minutes} min</span>}
            {volume > 0 && <span>{volume.toLocaleString()} kg vol.</span>}
          </div>
        </div>
        <Button
          variant="ghost" size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          disabled={deleting}
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {workout.notes && (
        <p className="text-xs text-muted-foreground mb-2 italic">{workout.notes}</p>
      )}

      {workout.exercises.length > 0 && (
        <div className="rounded-md border divide-y bg-muted/20">
          {workout.exercises.map((ex) => (
            <div key={ex.id} className="px-3 py-1.5 text-sm flex justify-between">
              <span className="font-medium">{ex.exercise_name}</span>
              <span className="text-muted-foreground text-xs">
                {ex.sets && ex.reps ? `${ex.sets}×${ex.reps}` : ""}
                {ex.weight_kg ? ` @ ${ex.weight_kg}kg` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
