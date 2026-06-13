/**
 * UTC-safe date helpers for the Shared Calendar (Req 10).
 *
 * Trying-window and event dates are plain ISO calendar dates (YYYY-MM-DD) with
 * no time zone. All formatting and arithmetic here is pinned to UTC so a date
 * never shifts a day across the local time zone — the day the engine computes
 * is the day the calendar shows (Req 10.3, Property 25).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Parse a `YYYY-MM-DD` string into a UTC epoch-ms value. */
function toUtcMs(iso: string): number {
  return Date.parse(`${iso}T00:00:00.000Z`);
}

/** Format `2026-06-27` as `Jun 27, 2026`. */
export function formatLong(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(toUtcMs(iso));
}

/** Format `2026-06-27` as `Sat, Jun 27`. */
export function formatWeekday(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(toUtcMs(iso));
}

/** The 3-letter uppercase month for a compact date badge, e.g. `JUL`. */
export function monthBadge(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" })
    .format(toUtcMs(iso))
    .toUpperCase();
}

/** The day-of-month for a compact date badge, e.g. `2`. */
export function dayBadge(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: "UTC" }).format(
    toUtcMs(iso),
  );
}

/** Whole-day count from `a` to `b` (b − a). Negative when b precedes a. */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / MS_PER_DAY);
}

/** Add `n` whole days to an ISO date, returning a new ISO date. */
export function addDays(iso: string, n: number): string {
  return new Date(toUtcMs(iso) + n * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Chronological comparator for ISO date strings (nulls sort last). */
export function compareIso(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}
