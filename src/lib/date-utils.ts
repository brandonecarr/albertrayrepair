/** Date-only (YYYY-MM-DD) helpers, parsed/formatted in local time. */

export function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function parseIso(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

export function addDays(iso: string, n: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + n);
  return isoOf(d);
}

/** Sunday-based start of the week containing `iso`. */
export function startOfWeekIso(iso: string): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() - d.getDay());
  return isoOf(d);
}

export function weekDates(startIso: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(startIso, i));
}

export function fmtWeekday(iso: string, style: "short" | "long" = "short"): string {
  return parseIso(iso).toLocaleDateString("en-US", { weekday: style });
}

export function fmtMonthDay(iso: string): string {
  return parseIso(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtRange(startIso: string, endIso: string): string {
  const s = parseIso(startIso);
  const e = parseIso(endIso);
  const sameMonth = s.getMonth() === e.getMonth();
  const sStr = s.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const eStr = e.toLocaleDateString("en-US", {
    month: sameMonth ? undefined : "short",
    day: "numeric",
    year: "numeric",
  });
  return `${sStr} – ${eStr}`;
}

export function isToday(iso: string): boolean {
  return iso === isoOf(new Date());
}

// ─── Month helpers ───────────────────────────────────────────────────────

/** First day of the month containing `iso`. */
export function startOfMonthIso(iso: string): string {
  const d = parseIso(iso);
  d.setDate(1);
  return isoOf(d);
}

/** Shift by whole months, snapping to the 1st (avoids day-overflow surprises). */
export function addMonths(iso: string, n: number): string {
  const d = parseIso(iso);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return isoOf(d);
}

/**
 * Full Sunday-aligned weeks covering the month of `anchorIso` (35 or 42 days).
 * Leading/trailing days spill into the adjacent months so the grid is square.
 */
export function monthGridDays(anchorIso: string): string[] {
  const first = startOfMonthIso(anchorIso);
  const lastDay = addDays(addMonths(first, 1), -1);
  const gridStart = startOfWeekIso(first);
  const gridEnd = addDays(startOfWeekIso(lastDay), 6);
  const days: string[] = [];
  let cur = gridStart;
  while (cur <= gridEnd) {
    days.push(cur);
    cur = addDays(cur, 1);
  }
  return days;
}

export function fmtMonthYear(iso: string): string {
  return parseIso(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** True when `iso` falls in the same calendar month as `anchorIso`. */
export function isSameMonth(iso: string, anchorIso: string): boolean {
  return iso.slice(0, 7) === anchorIso.slice(0, 7);
}

/** Day-of-month number (1–31) for display. */
export function dayOfMonth(iso: string): number {
  return parseIso(iso).getDate();
}
