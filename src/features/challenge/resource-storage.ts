import { randomUUID } from "node:crypto";
import { MAX_CHALLENGE_RESOURCE_BYTES } from "@/constants/challenge";
import { hasValidSubmissionFileSignature, validateSubmissionFileMetadata } from "@/features/submission/policy";
import { getStorageEnvironment } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function privateStorage() {
  const { SUBMISSION_STORAGE_BUCKET } = getStorageEnvironment();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.getBucket(SUBMISSION_STORAGE_BUCKET);
  if (error || !data || data.public) throw new Error("CHALLENGE_STORAGE_NOT_PRIVATE");
  return { bucket: SUBMISSION_STORAGE_BUCKET, supabase };
}

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
  const { bucket, supabase } = await privateStorage();
  const { error } = await supabase.storage.from(bucket).upload(path, await file.arrayBuffer(), {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error("CHALLENGE_RESOURCE_UPLOAD_FAILED");
}

export async function removeChallengeResource(path: string) {
  const { bucket, supabase } = await privateStorage();
  await supabase.storage.from(bucket).remove([path]);
}

export async function downloadChallengeResource(path: string) {
  const { bucket, supabase } = await privateStorage();
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) throw new Error("CHALLENGE_RESOURCE_DOWNLOAD_FAILED");
  return data;
}
