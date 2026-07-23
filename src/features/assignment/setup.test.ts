import { describe, expect, it } from "vitest";
import { ASSIGNMENT_SETUP_TYPE } from "@/constants/assignment";
import { getAssignmentSetupPath } from "./setup";

describe("assignment setup path", () => {
  it.each([
    [ASSIGNMENT_SETUP_TYPE.GENERAL_SUBMISSION, ""],
    [ASSIGNMENT_SETUP_TYPE.ONLINE_QUIZ, "/quiz/new"],
    [ASSIGNMENT_SETUP_TYPE.STATIC_CTF, "/ctf/new"],
    [ASSIGNMENT_SETUP_TYPE.EXTERNAL_CHALLENGE, "/challenges/new"],
  ])("routes %s to the matching setup screen", (setupType, suffix) => {
    expect(getAssignmentSetupPath("org-id", "assignment-id", setupType)).toBe(
      `/organizations/org-id/assignments/assignment-id${suffix}`,
    );
  });
});
