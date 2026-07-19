import { describe, expect, it } from "vitest";
import { adjacentCalendarMonth, parseCalendarMonth } from "./date";

describe("calendar month", () => {
  it("creates exact KST month boundaries", () => {
    const month = parseCalendarMonth("2026-07");
    expect(month?.start.toISOString()).toBe("2026-06-30T15:00:00.000Z");
    expect(month?.end.toISOString()).toBe("2026-07-31T15:00:00.000Z");
  });
  it("rejects invalid months and moves across years", () => {
    expect(parseCalendarMonth("2026-13")).toBeNull();
    expect(adjacentCalendarMonth(2026, 1, -1)).toBe("2025-12");
  });
});
