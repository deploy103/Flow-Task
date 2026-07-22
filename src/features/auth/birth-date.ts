export const MAXIMUM_SUPPORTED_AGE = 150;

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const KOREA_STANDARD_TIME_OFFSET_MILLISECONDS = 9 * 60 * 60 * 1_000;

function utcDate(year: number, month: number, day: number) {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export function parseBirthDate(value: string, today = new Date()) {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return null;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const birthDate = utcDate(year, month, day);
  if (
    birthDate.getUTCFullYear() !== year ||
    birthDate.getUTCMonth() !== month - 1 ||
    birthDate.getUTCDate() !== day
  ) return null;

  const koreanToday = new Date(today.getTime() + KOREA_STANDARD_TIME_OFFSET_MILLISECONDS);
  const todayUtc = utcDate(koreanToday.getUTCFullYear(), koreanToday.getUTCMonth() + 1, koreanToday.getUTCDate());
  if (birthDate > todayUtc || calculateAge(birthDate, todayUtc) > MAXIMUM_SUPPORTED_AGE) return null;
  return birthDate;
}

export function calculateAge(birthDate: Date, asOf = new Date()) {
  const koreanAsOf = new Date(asOf.getTime() + KOREA_STANDARD_TIME_OFFSET_MILLISECONDS);
  let age = koreanAsOf.getUTCFullYear() - birthDate.getUTCFullYear();
  const birthdayHasPassed =
    koreanAsOf.getUTCMonth() > birthDate.getUTCMonth() ||
    (koreanAsOf.getUTCMonth() === birthDate.getUTCMonth() && koreanAsOf.getUTCDate() >= birthDate.getUTCDate());
  if (!birthdayHasPassed) age -= 1;
  return age;
}

export function formatDateOnly(date: Date) {
  return [
    String(date.getUTCFullYear()).padStart(4, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}
