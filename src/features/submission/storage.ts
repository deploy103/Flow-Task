import { randomUUID } from "node:crypto";
import { MAX_SUBMISSION_FILE_SIZE_BYTES } from "@/constants/assignment";
import { getStorageEnvironment } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  hasValidSubmissionFileSignatureBytes,
  type ValidatedSubmissionFile,
} from "./policy";

async function getVerifiedPrivateStorage(requireUploadLimit = false) {
  const { SUBMISSION_STORAGE_BUCKET } = getStorageEnvironment();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.getBucket(SUBMISSION_STORAGE_BUCKET);
  if (error || !data || data.public) throw new Error("SUBMISSION_STORAGE_NOT_PRIVATE");
  if (
    requireUploadLimit &&
    (typeof data.file_size_limit !== "number" || data.file_size_limit > MAX_SUBMISSION_FILE_SIZE_BYTES)
  ) {
    throw new Error("SUBMISSION_STORAGE_FILE_LIMIT_INVALID");
  }
  return { bucket: SUBMISSION_STORAGE_BUCKET, supabase };
}

export async function createSignedSubmissionUpload(storagePath: string) {
  const { bucket, supabase } = await getVerifiedPrivateStorage(true);
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(storagePath, {
    upsert: false,
  });
  if (error || !data) throw new Error("SUBMISSION_SIGNED_UPLOAD_FAILED");
  return { bucket, path: data.path, token: data.token };
}

export async function verifyStoredSubmissionUpload(input: {
  storagePath: string;
  sizeBytes: number;
  mimeType: string;
  extension: ValidatedSubmissionFile["extension"];
}) {
  const { bucket, supabase } = await getVerifiedPrivateStorage(true);
  const { data: info, error: infoError } = await supabase.storage.from(bucket).info(input.storagePath);
  if (
    infoError ||
    !info ||
    info.size !== input.sizeBytes ||
    info.contentType?.toLowerCase() !== input.mimeType
  ) {
    return false;
  }
  const { data: signed, error: signedError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(input.storagePath, 60);
  if (signedError || !signed) return false;
  const response = await fetch(signed.signedUrl, {
    cache: "no-store",
    headers: { Range: "bytes=0-7" },
  });
  const contentLength = Number(response.headers.get("content-length"));
  if (response.status !== 206 || !Number.isInteger(contentLength) || contentLength > 8) {
    await response.body?.cancel();
    return false;
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  return hasValidSubmissionFileSignatureBytes(bytes, input.extension);
}

export function createSubmissionStoragePath(input: {
  organizationId: string;
  assignmentId: string;
  userId: string;
  extension: string;
}) {
  return `${input.organizationId}/${input.assignmentId}/${input.userId}/${randomUUID()}.${input.extension}`;
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
