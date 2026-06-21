export function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return formatDate(iso);
}

export function formatWeight(kg: number | null): string {
  if (kg == null) return "—";
  return `${kg} kg`;
}

export function formatCalories(cal: number | null): string {
  if (cal == null) return "—";
  return `${Math.round(cal)} kcal`;
}

export function formatMacro(g: number | null): string {
  if (g == null) return "—";
  return `${Math.round(g)}g`;
}

export function goalTypeLabel(type: string): string {
  const map: Record<string, string> = {
    weight_loss: "Weight Loss",
    muscle_gain: "Muscle Gain",
    strength: "Strength",
    recomposition: "Recomposition",
    maintenance: "Maintenance",
  };
  return map[type] ?? type;
}
