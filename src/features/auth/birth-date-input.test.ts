import { describe, expect, it } from "vitest";
import { composeBirthDate, getDaysInBirthMonth, getSignupBirthYears } from "./birth-date-input";

describe("signup birth date input", () => {
  it("offers only supported signup years in descending order", () => {
    const years = getSignupBirthYears(new Date("2026-07-24T00:00:00Z"));
    expect(years[0]).toBe(2012);
    expect(years.at(-1)).toBe(1876);
  });

  it("uses real month lengths including leap years", () => {
    expect(getDaysInBirthMonth("2000", "02")).toBe(29);
    expect(getDaysInBirthMonth("2001", "02")).toBe(28);
    expect(getDaysInBirthMonth("2001", "04")).toBe(30);
  });

  it("composes only a complete four-two-two digit date", () => {
    expect(composeBirthDate({ year: "2000", month: "01", day: "02" })).toBe("2000-01-02");
    expect(composeBirthDate({ year: "2000", month: "", day: "02" })).toBe("");
    expect(composeBirthDate({ year: "200000", month: "", day: "" })).toBe("");
  });
});
