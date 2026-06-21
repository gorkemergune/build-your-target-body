"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { X, Search, Dumbbell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { Exercise, ExerciseCategory, MuscleGroup } from "@/types";

interface Props {
  locale: string;
  onSelect: (exercise: Exercise) => void;
  onClose: () => void;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  intermediate: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  advanced: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export function ExercisePickerModal({ locale, onSelect, onClose }: Props) {
  const t = useTranslations("workouts");
  const isTr = locale === "tr";

  const [categories, setCategories] = useState<ExerciseCategory[]>([]);
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);

  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [muscleId, setMuscleId] = useState<number | null>(null);

  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([
      api.get("/api/v1/exercises/categories"),
      api.get("/api/v1/exercises/muscle-groups"),
    ]).then(([catRes, mgRes]) => {
      setCategories(catRes.data);
      setMuscleGroups(mgRes.data);
    });
    fetchExercises("", null, null);
  }, []);

  function fetchExercises(q: string, catId: number | null, mgId: number | null) {
    setLoading(true);
    const params = new URLSearchParams({ limit: "80" });
    if (q.trim()) params.set("q", q.trim());
    if (catId) params.set("category_id", String(catId));
    if (mgId) params.set("muscle_group_id", String(mgId));
    api.get(`/api/v1/exercises?${params}`).then((r) => {
      setExercises(r.data);
      setLoading(false);
    });
  }

  function handleSearch(value: string) {
    setQuery(value);
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => {
      fetchExercises(value, categoryId, muscleId);
    }, 250);
  }

  function handleCategory(id: number | null) {
    setCategoryId(id);
    setMuscleId(null);
    fetchExercises(query, id, null);
  }

  function handleMuscle(id: number | null) {
    setMuscleId(id);
    fetchExercises(query, categoryId, id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="relative bg-background w-full sm:max-w-2xl sm:rounded-xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b">
          <Dumbbell className="h-5 w-5 text-primary" />
          <span className="font-semibold text-base">{t("pickExercise")}</span>
          <button
            onClick={onClose}
            className="ml-auto rounded-md p-1.5 hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-3 pb-2 border-b space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder={t("searchExercise")}
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          {/* Category tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => handleCategory(null)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                categoryId === null
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              {t("allCategories")}
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategory(categoryId === cat.id ? null : cat.id)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  categoryId === cat.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                {isTr ? cat.name_tr : cat.name}
              </button>
            ))}
          </div>

          {/* Muscle group filter */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => handleMuscle(null)}
              className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs transition-colors ${
                muscleId === null
                  ? "bg-secondary text-secondary-foreground"
                  : "bg-muted/60 hover:bg-muted"
              }`}
            >
              {t("allMuscles")}
            </button>
            {muscleGroups.map((mg) => (
              <button
                key={mg.id}
                onClick={() => handleMuscle(muscleId === mg.id ? null : mg.id)}
                className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs transition-colors ${
                  muscleId === mg.id
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-muted/60 hover:bg-muted"
                }`}
              >
                {isTr ? mg.name_tr : mg.name}
              </button>
            ))}
          </div>
        </div>

        {/* Exercise list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              {t("loading")}
            </div>
          ) : exercises.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm gap-2">
              <Dumbbell className="h-8 w-8 opacity-30" />
              <span>{t("noExercisesFound")}</span>
            </div>
          ) : (
            <div className="divide-y">
              {exercises.map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => onSelect(ex)}
                  className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm leading-tight">
                        {ex.name}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                          {isTr ? ex.primary_muscle.name_tr : ex.primary_muscle.name}
                        </span>
                        {ex.secondary_muscles.slice(0, 2).map((m) => (
                          <span
                            key={m}
                            className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          DIFFICULTY_COLORS[ex.difficulty] ?? ""
                        }`}
                      >
                        {t(`difficulty_${ex.difficulty}`)}
                      </span>
                      <span className="text-xs text-muted-foreground capitalize">{ex.equipment}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
