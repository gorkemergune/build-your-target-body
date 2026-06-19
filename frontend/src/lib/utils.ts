import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string, locale = "tr"): string {
  return new Date(dateStr).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatNumber(value: number | null | undefined, decimals = 1): string {
  if (value == null) return "—";
  return value.toFixed(decimals);
}

export function formatChange(value: number | null | undefined, unit = ""): string {
  if (value == null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}${unit}`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function localeDateToISO(localDate: string): string {
  // Converts a YYYY-MM-DD local date string to UTC midnight ISO string
  return new Date(`${localDate}T12:00:00`).toISOString();
}
