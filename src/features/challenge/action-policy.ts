import type { ChallengeAttemptAccessReason } from "./access";

export type ChallengeActionError =
  | "not_target"
  | "not_open"
  | "closed"
  | "already_completed"
  | "attempt_limit"
  | "flag_required"
  | "writeup_required"
  | "writeup_url_required";

const CHALLENGE_ACCESS_ERRORS = {
  NOT_TARGET: "not_target",
  NOT_OPEN: "not_open",
  CLOSED: "closed",
  COMPLETED: "already_completed",
  ATTEMPT_LIMIT: "attempt_limit",
} as const satisfies Record<Exclude<ChallengeAttemptAccessReason, "ALLOWED">, ChallengeActionError>;

export function getChallengeAccessError(
  reason: Exclude<ChallengeAttemptAccessReason, "ALLOWED">,
): ChallengeActionError {
  return CHALLENGE_ACCESS_ERRORS[reason];
}

export function hasChallengeSubmissionMethod(input: {
  flag?: string | null;
  requireWriteup: boolean;
  requireWriteupUrl: boolean;
}) {
  return Boolean(input.flag?.trim() || input.requireWriteup || input.requireWriteupUrl);
}

type ResolveChallengeSubmissionValuesInput = {
  requiresCorrectFlag: boolean;
  requireWriteup: boolean;
  requireWriteupUrl: boolean;
  submittedFlag?: string;
  submittedWriteup?: string;
  submittedWriteupUrl?: string;
  existingWriteup?: string | null;
  existingWriteupUrl?: string | null;
};

export type ResolvedChallengeSubmissionValues = {
  flag: string | null;
  writeup: string | null;
  writeupUrl: string | null;
};

export function resolveChallengeSubmissionValues(
  input: ResolveChallengeSubmissionValuesInput,
):
  | { success: true; data: ResolvedChallengeSubmissionValues }
  | { success: false; error: ChallengeActionError } {
  const flag = input.submittedFlag?.trim() ? input.submittedFlag : null;
  const submittedWriteup = input.submittedWriteup?.trim() ? input.submittedWriteup : null;
  const submittedWriteupUrl = input.submittedWriteupUrl?.trim()
    ? input.submittedWriteupUrl
    : null;
  const writeup = submittedWriteup ?? input.existingWriteup ?? null;
  const writeupUrl = submittedWriteupUrl ?? input.existingWriteupUrl ?? null;

  if (input.requiresCorrectFlag && !flag) {
    return { success: false, error: "flag_required" };
  }
  if (input.requireWriteup && !writeup?.trim()) {
    return { success: false, error: "writeup_required" };
  }
  if (input.requireWriteupUrl && !writeupUrl?.trim()) {
    return { success: false, error: "writeup_url_required" };
  }

  return {
    success: true,
    data: {
      flag,
      writeup,
      writeupUrl,
    },
  };
}
