"use client";

import { useState } from "react";
import { composeBirthDate, getDaysInBirthMonth, getSignupBirthYears, type BirthDateParts } from "@/features/auth/birth-date-input";

const SELECT_CLASS = "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50";
const EMPTY_PARTS: BirthDateParts = { year: "", month: "", day: "" };

export function BirthDateField({ onChange }: { onChange: (value: string) => void }) {
  const [parts, setParts] = useState(EMPTY_PARTS);
  const [years] = useState(() => getSignupBirthYears());
  const dayCount = getDaysInBirthMonth(parts.year, parts.month);

  const updatePart = (field: keyof BirthDateParts, value: string) => {
    const next = { ...parts, [field]: value };
    const nextDayCount = getDaysInBirthMonth(next.year, next.month);
    if (next.day && Number(next.day) > nextDayCount) next.day = "";
    setParts(next);
    onChange(composeBirthDate(next));
  };

  return (
    <fieldset aria-describedby="birth-date-help">
      <legend className="text-sm font-medium">생년월일</legend>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <label className="text-xs text-slate-500">연도
          <select required autoComplete="bday-year" aria-label="출생 연도" className={`${SELECT_CLASS} mt-1`} value={parts.year} onChange={(event) => updatePart("year", event.target.value)}>
            <option value="">연도</option>
            {years.map((year) => <option key={year} value={year}>{year}년</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-500">월
          <select required autoComplete="bday-month" aria-label="출생 월" className={`${SELECT_CLASS} mt-1`} value={parts.month} onChange={(event) => updatePart("month", event.target.value)}>
            <option value="">월</option>
            {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")).map((month) => <option key={month} value={month}>{Number(month)}월</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-500">일
          <select required autoComplete="bday-day" aria-label="출생 일" className={`${SELECT_CLASS} mt-1`} value={parts.day} onChange={(event) => updatePart("day", event.target.value)}>
            <option value="">일</option>
            {Array.from({ length: dayCount }, (_, index) => String(index + 1).padStart(2, "0")).map((day) => <option key={day} value={day}>{Number(day)}일</option>)}
          </select>
        </label>
      </div>
      <input name="birthDate" type="hidden" value={composeBirthDate(parts)} />
      <p id="birth-date-help" className="mt-1 text-xs text-slate-500">연·월·일을 차례로 선택해 주세요. 만 14세 이상만 가입할 수 있습니다.</p>
    </fieldset>
  );
}
