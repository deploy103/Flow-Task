import { QuizIntegrityEventType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { digestQuizClientIp, integrityDedupeKey, isPlausibleIntegrityTime } from "./integrity";

describe("quiz integrity event policy", () => {
  it("deduplicates each signal per server minute", () => {
    const first = new Date("2026-07-20T11:20:01Z");
    const second = new Date("2026-07-20T11:20:59Z");
    expect(integrityDedupeKey(QuizIntegrityEventType.TAB_HIDDEN, first)).toBe(integrityDedupeKey(QuizIntegrityEventType.TAB_HIDDEN, second));
    expect(integrityDedupeKey(QuizIntegrityEventType.COPY, first)).not.toBe(integrityDedupeKey(QuizIntegrityEventType.PASTE, first));
  });
  it("rejects timestamps outside a five minute clock window", () => {
    const now = new Date("2026-07-20T11:25:00Z");
    expect(isPlausibleIntegrityTime(new Date("2026-07-20T11:20:00Z"), now)).toBe(true);
    expect(isPlausibleIntegrityTime(new Date("2026-07-20T11:19:59Z"), now)).toBe(false);
  });
  it("stores a domain-separated digest instead of a raw address", () => {
    const ip = "203.0.113.7";
    const digest = digestQuizClientIp(ip, "integrity-test-pepper-at-least-32-characters");
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).not.toContain(ip);
  });
});
