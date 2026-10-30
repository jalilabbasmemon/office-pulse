import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null || Number.isNaN(minutes)) return "--";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
}

export function formatTime(
  iso: string | null | undefined,
  timeZone = "Asia/Karachi"
): string {
  if (!iso) return "--";
  return new Intl.DateTimeFormat("en-PK", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).format(new Date(iso));
}

export function formatDate(
  value: string | Date,
  timeZone = "Asia/Karachi"
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-PK", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(date);
}

export function formatShortDate(
  value: string | Date,
  timeZone = "Asia/Karachi"
): string {
  const date =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T12:00:00Z`)
      : typeof value === "string"
        ? new Date(value)
        : value;
  return new Intl.DateTimeFormat("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(date);
}
