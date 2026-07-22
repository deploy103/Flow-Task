import { describe, expect, it } from "vitest";
import { calculateAge, formatDateOnly, parseBirthDate } from "./birth-date";

describe("birth date", () => {
  const today = new Date("2026-07-23T12:00:00Z");

  it("parses a real date without timezone drift", () => {
    const parsed = parseBirthDate("2008-02-29", today);
    expect(parsed?.toISOString()).toBe("2008-02-29T00:00:00.000Z");
    expect(parsed && formatDateOnly(parsed)).toBe("2008-02-29");
  });

  it("rejects normalized, future, and implausibly old dates", () => {
    expect(parseBirthDate("2008-02-30", today)).toBeNull();
    expect(parseBirthDate("2026-07-24", today)).toBeNull();
    expect(parseBirthDate("1800-01-01", today)).toBeNull();
  });

  it("calculates international age around the birthday", () => {
    const birthDate = new Date("2008-07-23T00:00:00Z");
    expect(calculateAge(birthDate, new Date("2026-07-22T00:00:00Z"))).toBe(17);
    expect(calculateAge(birthDate, new Date("2026-07-23T00:00:00Z"))).toBe(18);
    expect(calculateAge(birthDate, new Date("2026-07-22T15:00:00Z"))).toBe(18);
  });
});
