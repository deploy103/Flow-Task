import { createHash, randomInt } from "node:crypto";
import { getServerEnvironment } from "@/lib/env";

const INVITATION_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INVITATION_CODE_LENGTH = 12;

export function generateInvitationCode() {
  return Array.from(
    { length: INVITATION_CODE_LENGTH },
    () => INVITATION_ALPHABET[randomInt(INVITATION_ALPHABET.length)],
  ).join("");
}

export function hashInvitationCode(code: string) {
  const { INVITATION_CODE_PEPPER } = getServerEnvironment();
  return createHash("sha256")
    .update(`${INVITATION_CODE_PEPPER}:${code.trim().toUpperCase()}`)
    .digest("hex");
}
