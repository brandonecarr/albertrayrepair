/**
 * Business-timezone helpers.
 *
 * The app runs on Vercel where the server clock is UTC, but Albert's business
 * (Apple Valley / High Desert, CA) operates in Pacific time. Any date math that
 * starts from "now" — report ranges, "today" — must be anchored to the business
 * timezone or month/day boundaries drift by the UTC offset near midnight.
 *
 * Pure calendar-date math (the weekday of a fixed YYYY-MM-DD) is timezone
 * independent as long as the string is parsed consistently; use `weekdayOfIso`.
 */

export const BUSINESS_TZ = "America/Los_Angeles";

/** Wall-clock parts of an absolute instant, as seen in `tz`. */
function partsInTz(instant: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const p = Object.fromEntries(fmt.formatToParts(instant).map((x) => [x.type, x.value]));
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour === "24" ? "0" : p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
  };
}

/**
 * The absolute instant (UTC Date) for a wall-clock time in the business tz.
 * Uses one offset-correction pass — exact except inside a DST transition hour,
 * which is acceptable for report boundaries.
 */
export function businessWallTimeToUtc(
  y: number,
  month1: number, // 1-12
  d: number,
  h = 0,
  mi = 0,
  s = 0,
  tz: string = BUSINESS_TZ
): Date {
  const utcGuess = Date.UTC(y, month1 - 1, d, h, mi, s);
  const back = partsInTz(new Date(utcGuess), tz);
  const rebuilt = Date.UTC(back.year, back.month - 1, back.day, back.hour, back.minute, back.second);
  const offset = rebuilt - utcGuess; // how far ahead of UTC the tz is at this instant
  return new Date(utcGuess - offset);
}

/** Year/month/day of `now` as seen in the business timezone. */
export function businessNowParts(now: Date = new Date()): { year: number; month: number; day: number } {
  const p = partsInTz(now, BUSINESS_TZ);
  return { year: p.year, month: p.month, day: p.day };
}

/** Today's calendar date (YYYY-MM-DD) in the business timezone. */
export function businessTodayIso(now: Date = new Date()): string {
  const { year, month, day } = businessNowParts(now);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Weekday (0=Sun … 6=Sat) of a YYYY-MM-DD date — timezone independent. */
export function weekdayOfIso(dateIso: string): number {
  return new Date(`${dateIso}T00:00:00Z`).getUTCDay();
}
