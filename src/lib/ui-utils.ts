"use client";

/** Shared UI helpers */

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function faNum(n: number | string): string {
  return String(n).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

export function faSize(mb: number): string {
  if (mb >= 1) return `${faNum(mb.toFixed(mb >= 10 ? 0 : 1))} مگابایت`;
  return `${faNum(Math.round(mb * 1024))} کیلوبایت`;
}

export function faDate(ts: number): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return "";
  }
}

export function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "همین حالا";
  const m = Math.floor(s / 60);
  if (m < 60) return `${faNum(m)} دقیقه پیش`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${faNum(h)} ساعت پیش`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${faNum(d)} روز پیش`;
  return faDate(ts);
}

/** subject → lucide icon component map lives in subject-meta.tsx */
export const STAGE_LABEL: Record<string, string> = {
  elementary: "دبستان",
  middle: "متوسطهٔ اول",
};
