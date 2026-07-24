import { MINIMUM_SIGNUP_AGE } from "@/constants/privacy";
import { MAXIMUM_SUPPORTED_AGE } from "./birth-date";

const KOREA_STANDARD_TIME_OFFSET_MILLISECONDS = 9 * 60 * 60 * 1_000;

export type BirthDateParts = { year: string; month: string; day: string };

export function getSignupBirthYears(now = new Date()) {
  const koreanNow = new Date(now.getTime() + KOREA_STANDARD_TIME_OFFSET_MILLISECONDS);
  const currentYear = koreanNow.getUTCFullYear();
  return Array.from(
    { length: MAXIMUM_SUPPORTED_AGE - MINIMUM_SIGNUP_AGE + 1 },
    (_, index) => currentYear - MINIMUM_SIGNUP_AGE - index,
  );
}

export function getDaysInBirthMonth(year: string, month: string) {
  if (!/^\d{4}$/.test(year) || !/^(0?[1-9]|1[0-2])$/.test(month)) return 31;
  return new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
}

export function composeBirthDate({ year, month, day }: BirthDateParts) {
  if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month) || !/^\d{2}$/.test(day)) return "";
  return `${year}-${month}-${day}`;
}
