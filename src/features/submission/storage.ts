import { randomUUID } from "node:crypto";
import { getStorageEnvironment } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ValidatedSubmissionFile } from "./policy";

async function getVerifiedPrivateStorage() {
  const { SUBMISSION_STORAGE_BUCKET } = getStorageEnvironment();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.getBucket(SUBMISSION_STORAGE_BUCKET);
  if (error || !data || data.public) throw new Error("SUBMISSION_STORAGE_NOT_PRIVATE");
  return { bucket: SUBMISSION_STORAGE_BUCKET, supabase };
}

export function createSubmissionStoragePath(input: {
  organizationId: string;
  assignmentId: string;
  userId: string;
  extension: string;
}) {
  return `${input.organizationId}/${input.assignmentId}/${input.userId}/${randomUUID()}.${input.extension}`;
}

export async function uploadSubmissionFile(
  file: File,
  metadata: ValidatedSubmissionFile,
  context: { organizationId: string; assignmentId: string; userId: string },
) {
  const storagePath = createSubmissionStoragePath({ ...context, extension: metadata.extension });
  const { bucket, supabase } = await getVerifiedPrivateStorage();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, await file.arrayBuffer(), {
      contentType: metadata.mimeType,
      upsert: false,
    });
  if (error) throw new Error("SUBMISSION_FILE_UPLOAD_FAILED");
  return storagePath;
}

export async function removeSubmissionFile(storagePath: string) {
  const { bucket, supabase } = await getVerifiedPrivateStorage();
  const { error } = await supabase.storage.from(bucket).remove([storagePath]);
  if (error) throw new Error("SUBMISSION_FILE_REMOVE_FAILED");
}

export async function downloadSubmissionFile(storagePath: string) {
  const { bucket, supabase } = await getVerifiedPrivateStorage();
  const { data, error } = await supabase.storage.from(bucket).download(storagePath);
  if (error || !data) throw new Error("SUBMISSION_FILE_DOWNLOAD_FAILED");
  return data;
}
