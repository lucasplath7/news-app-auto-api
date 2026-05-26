import type { DateRangePreset } from "../schemas/news/politics.schemas.js";

export function formatYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function toDateRangeString(preset: DateRangePreset, now: Date = new Date()): string {
  const today = formatYYYYMMDD(now);
  if (preset === "week") return `${formatYYYYMMDD(addDays(now, -7))} to ${today}`;
  if (preset === "yesterday") return `${formatYYYYMMDD(addDays(now, -1))} to ${today}`;
  return `${today} to ${today}`;
}

