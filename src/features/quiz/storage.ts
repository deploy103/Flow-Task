import { randomUUID } from "node:crypto";
import { MAX_QUIZ_FILE_BYTES } from "@/constants/quiz";
import { hasValidSubmissionFileSignature, validateSubmissionFileMetadata } from "@/features/submission/policy";
import { readPrivateFile, removePrivateFile, writePrivateFile } from "@/lib/storage/local";

export async function validateQuizFile(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || (value.size === 0 && value.name === "")) return null;
  const metadata = validateSubmissionFileMetadata(value);
  if (!metadata || value.size > MAX_QUIZ_FILE_BYTES || !(await hasValidSubmissionFileSignature(value, metadata.extension))) throw new Error("INVALID_QUIZ_FILE");
  return { file: value, metadata };
}

export function quizFilePath(organizationId: string, userId: string, extension: string) {
  return `${organizationId}/quiz-answers/${userId}/${randomUUID()}.${extension}`;
}

export async function uploadQuizFile(path: string, file: File) {
  await writePrivateFile(path, await file.arrayBuffer());
}

export async function removeQuizFile(path: string) {
  await removePrivateFile(path);
}

export async function downloadQuizFile(path: string) {
  return readPrivateFile(path);
}
