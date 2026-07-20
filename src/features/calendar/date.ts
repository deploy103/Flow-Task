const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function parseCalendarMonth(value: string | undefined, now = new Date()) {
  const fallback = new Date(now.getTime() + KST_OFFSET_MS);
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  const year = match ? Number(match[1]) : fallback.getUTCFullYear();
  const month = match ? Number(match[2]) : fallback.getUTCMonth() + 1;
  if (year < 1 || year > 9999 || month < 1 || month > 12) return null;
  const start = new Date(Date.UTC(year, month - 1, 1) - KST_OFFSET_MS);
  const end = new Date(Date.UTC(year, month, 1) - KST_OFFSET_MS);
  return { year, month, start, end, key: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}` };
}

export function adjacentCalendarMonth(year: number, month: number, offset: number) {
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
