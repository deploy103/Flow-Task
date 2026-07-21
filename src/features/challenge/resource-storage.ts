import { randomUUID } from "node:crypto";
import { MAX_CHALLENGE_RESOURCE_BYTES } from "@/constants/challenge";
import { hasValidSubmissionFileSignature, validateSubmissionFileMetadata } from "@/features/submission/policy";
import { readPrivateFile, removePrivateFile, writePrivateFile } from "@/lib/storage/local";

export async function validateChallengeResource(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || (value.size === 0 && value.name === "")) return null;
  const metadata = validateSubmissionFileMetadata(value);
  if (
    !metadata ||
    value.size > MAX_CHALLENGE_RESOURCE_BYTES ||
    !(await hasValidSubmissionFileSignature(value, metadata.extension))
  ) throw new Error("INVALID_CHALLENGE_RESOURCE");
  return { file: value, metadata };
}

export function challengeResourcePath(organizationId: string, userId: string, extension: string) {
  return `${organizationId}/challenges/${userId}/${randomUUID()}.${extension}`;
}

export async function uploadChallengeResource(path: string, file: File) {
  await writePrivateFile(path, await file.arrayBuffer());
}

export async function removeChallengeResource(path: string) {
  await removePrivateFile(path);
}

export async function downloadChallengeResource(path: string) {
  return readPrivateFile(path);
}
