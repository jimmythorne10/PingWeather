/**
 * Pure helpers extracted from day-detail.tsx for unit-testability.
 *
 * findDayIndex: find the index of a date string in the daily time array.
 * The critical guard: an empty `date` must return -1, not 0.
 * (String.prototype.startsWith('') is always true, so the naive impl
 * silently shows day 0 instead of an error when date is missing.)
 */

/**
 * Returns the index of `date` in `times` by prefix match, or -1 if not found.
 * Returns -1 immediately when `date` is empty to avoid the startsWith('') trap.
 */
export function findDayIndex(times: string[], date: string): number {
  if (!date) return -1;
  return times.findIndex((d) => d.startsWith(date));
}
