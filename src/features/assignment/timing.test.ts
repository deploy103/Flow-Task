import { describe, expect, it } from "vitest";
import { getAssignmentTimingStatus, getDeadlineLabel } from "./timing";

const opensAt = new Date("2026-07-16T00:00:00Z");
const deadline = new Date("2026-07-18T00:00:00Z");

describe("assignment timing", () => {
  it("derives upcoming and open statuses", () => {
    expect(getAssignmentTimingStatus({ opensAt, deadline, allowLate: false }, new Date("2026-07-15T23:59:59Z"))).toBe("UPCOMING");
    expect(getAssignmentTimingStatus({ opensAt, deadline, allowLate: false }, opensAt)).toBe("OPEN");
  });

  it("distinguishes closed assignments from late-open assignments", () => {
    const afterDeadline = new Date("2026-07-18T00:00:01Z");
    expect(getAssignmentTimingStatus({ opensAt, deadline, allowLate: false }, afterDeadline)).toBe("CLOSED");
    expect(getAssignmentTimingStatus({ opensAt, deadline, allowLate: true }, afterDeadline)).toBe("LATE_OPEN");
  });

  it("creates an understandable deadline label", () => {
    expect(getDeadlineLabel(deadline, new Date("2026-07-16T12:00:00Z"))).toBe("D-2");
    expect(getDeadlineLabel(deadline, new Date("2026-07-17T18:00:00Z"))).toBe("오늘 마감");
    expect(getDeadlineLabel(deadline, new Date("2026-07-18T00:00:01Z"))).toBe("마감 종료");
  });
});
