export type RecentDetailWindow = {
  dateFrom: string;
  dateTo: string;
  dates: string[];
};

/**
 * Keeps the recovery window deliberately small: the live day plus the three
 * immediately preceding days are the only days that can still be incomplete.
 */
export function recentDetailWindow(dateTo: string, days: number): RecentDetailWindow {
  const safeDays = Math.max(1, Math.min(4, Math.floor(days)));
  const dates = Array.from({ length: safeDays }, (_value, index) => shiftDate(dateTo, -(safeDays - index - 1)));
  return { dateFrom: dates[0], dateTo, dates };
}

export function datesNeedingBaseRefresh(
  window: RecentDetailWindow,
  syncedDates: Iterable<string>,
  refreshLastDate: boolean
) {
  const synced = new Set(syncedDates);
  return window.dates.filter((date) => (refreshLastDate && date === window.dateTo) || !synced.has(date));
}

function shiftDate(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
