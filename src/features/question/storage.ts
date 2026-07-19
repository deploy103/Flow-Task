import { randomUUID } from "node:crypto";
import { getStorageEnvironment } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasValidSubmissionFileSignature, validateSubmissionFileMetadata } from "@/features/submission/policy";

export const MAX_QUESTION_ATTACHMENT_BYTES = 512 * 1024;

async function privateStorage() {
  const { SUBMISSION_STORAGE_BUCKET } = getStorageEnvironment();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.getBucket(SUBMISSION_STORAGE_BUCKET);
  if (error || !data || data.public) throw new Error("QUESTION_STORAGE_NOT_PRIVATE");
  return { bucket: SUBMISSION_STORAGE_BUCKET, supabase };
}

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
  const { bucket, supabase } = await privateStorage();
  const { error } = await supabase.storage.from(bucket).upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (error) throw new Error("QUESTION_ATTACHMENT_UPLOAD_FAILED");
}

export async function removeQuestionAttachment(path: string) {
  const { bucket, supabase } = await privateStorage();
  await supabase.storage.from(bucket).remove([path]);
}

export async function downloadQuestionAttachment(path: string) {
  const { bucket, supabase } = await privateStorage();
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) throw new Error("QUESTION_ATTACHMENT_DOWNLOAD_FAILED");
  return data;
}
