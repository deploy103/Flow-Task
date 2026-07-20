import { randomUUID } from "node:crypto";
import { MAX_QUIZ_FILE_BYTES } from "@/constants/quiz";
import { hasValidSubmissionFileSignature, validateSubmissionFileMetadata } from "@/features/submission/policy";
import { getStorageEnvironment } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function privateStorage() {
  const { SUBMISSION_STORAGE_BUCKET } = getStorageEnvironment();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.getBucket(SUBMISSION_STORAGE_BUCKET);
  if (error || !data || data.public) throw new Error("QUIZ_STORAGE_NOT_PRIVATE");
  return { bucket: SUBMISSION_STORAGE_BUCKET, supabase };
}

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
  const { bucket, supabase } = await privateStorage();
  const { error } = await supabase.storage.from(bucket).upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (error) throw new Error("QUIZ_FILE_UPLOAD_FAILED");
}

export async function removeQuizFile(path: string) {
  const { bucket, supabase } = await privateStorage();
  await supabase.storage.from(bucket).remove([path]);
}

export async function downloadQuizFile(path: string) {
  const { bucket, supabase } = await privateStorage();
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) throw new Error("QUIZ_FILE_DOWNLOAD_FAILED");
  return data;
}
