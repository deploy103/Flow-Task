import { randomUUID } from "node:crypto";
import { hasValidSubmissionFileSignature, validateSubmissionFileMetadata } from "@/features/submission/policy";
import { readPrivateFile, removePrivateFile, writePrivateFile } from "@/lib/storage/local";

export const MAX_QUESTION_ATTACHMENT_BYTES = 512 * 1024;

export async function validateQuestionAttachment(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || (value.size === 0 && value.name === "")) return null;
  const metadata = validateSubmissionFileMetadata(value);
  if (!metadata || value.size > MAX_QUESTION_ATTACHMENT_BYTES || !(await hasValidSubmissionFileSignature(value, metadata.extension))) throw new Error("INVALID_QUESTION_ATTACHMENT");
  return { file: value, metadata };
}

export function questionStoragePath(organizationId: string, userId: string, extension: string) {
  return `${organizationId}/questions/${userId}/${randomUUID()}.${extension}`;
}

export async function uploadQuestionAttachment(path: string, file: File) {
  await writePrivateFile(path, await file.arrayBuffer());
}

export async function removeQuestionAttachment(path: string) {
  await removePrivateFile(path);
}

export async function downloadQuestionAttachment(path: string) {
  return readPrivateFile(path);
}
