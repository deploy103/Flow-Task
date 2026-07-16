"use client";

import { useState, type ChangeEvent } from "react";
import { Input } from "@/components/ui/input";
import {
  BYTES_PER_MEBIBYTE,
  MAX_SUBMISSION_FILE_COUNT,
  MAX_SUBMISSION_TOTAL_FILE_SIZE_BYTES,
} from "@/constants/assignment";
import {
  collectSubmissionFiles,
  hasValidSubmissionFileSignature,
  validateSubmissionFile,
} from "@/features/submission/policy";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useSubmissionUpload } from "./submission-upload-context";

type UploadGrant = {
  uploadId: string;
  bucket: string;
  path: string;
  token: string;
};

export function SubmissionFileInput({
  accept,
  assignmentId,
  disabled,
  fieldId,
  organizationId,
}: {
  accept: string;
  assignmentId: string;
  disabled: boolean;
  fieldId: string;
  organizationId: string;
}) {
  const [uploads, setUploads] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { uploading, setUploading } = useSubmissionUpload();
  const endpoint = `/api/organizations/${organizationId}/assignments/${assignmentId}/submission-uploads`;

  async function cancelUploads(uploadIds: string[]) {
    if (!uploadIds.length) return true;
    const response = await fetch(endpoint, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadIds }),
    });
    return response.ok;
  }

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    setError(null);
    const collected = collectSubmissionFiles(files);
    if (!collected.success || !files.length) {
      setError(
        `파일은 최대 ${MAX_SUBMISSION_FILE_COUNT}개, 전체 ${MAX_SUBMISSION_TOTAL_FILE_SIZE_BYTES / BYTES_PER_MEBIBYTE}MB까지 선택할 수 있습니다.`,
      );
      input.value = "";
      return;
    }
    if (
      files.length > MAX_SUBMISSION_FILE_COUNT ||
      files.reduce((total, file) => total + file.size, 0) > MAX_SUBMISSION_TOTAL_FILE_SIZE_BYTES
    ) {
      setError("파일 개수 또는 전체 용량을 초과했습니다.");
      input.value = "";
      return;
    }
    setUploading(true);
    const completed: { id: string; name: string }[] = [];
    try {
      if (!(await cancelUploads(uploads.map(({ id }) => id)))) {
        throw new Error("UPLOAD_CANCEL_FAILED");
      }
      setUploads([]);
      for (const file of files) {
        const metadata = validateSubmissionFile(file);
        if (!metadata || !(await hasValidSubmissionFileSignature(file, metadata.extension))) {
          throw new Error("INVALID_FILE");
        }
        const grantResponse = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fieldId,
            filename: metadata.originalFilename,
            mimeType: metadata.mimeType,
            sizeBytes: metadata.sizeBytes,
          }),
        });
        const grantBody = (await grantResponse.json()) as {
          success: boolean;
          data?: UploadGrant;
        };
        if (!grantResponse.ok || !grantBody.success || !grantBody.data) {
          throw new Error("UPLOAD_GRANT_FAILED");
        }
        const grant = grantBody.data;
        const supabase = createSupabaseBrowserClient();
        const { error: uploadError } = await supabase.storage
          .from(grant.bucket)
          .uploadToSignedUrl(grant.path, grant.token, file, {
            contentType: metadata.mimeType,
            upsert: false,
          });
        if (uploadError) {
          await cancelUploads([grant.uploadId]);
          throw new Error("UPLOAD_FAILED");
        }
        completed.push({ id: grant.uploadId, name: metadata.originalFilename });
        setUploads([...completed]);
      }
    } catch {
      await Promise.allSettled([cancelUploads(completed.map(({ id }) => id))]);
      setUploads([]);
      setError("파일 업로드에 실패했습니다. 잠시 후 다시 선택해 주세요.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <Input
        accept={accept}
        className="mt-3 pt-2"
        disabled={disabled || uploading}
        id={`field-${fieldId}`}
        multiple
        onChange={handleFiles}
        type="file"
      />
      {uploads.map((upload) => (
        <input key={upload.id} name={`upload-${fieldId}`} type="hidden" value={upload.id} />
      ))}
      {uploads.length > 0 && (
        <p className="mt-2 text-sm font-semibold text-emerald-600">{uploads.length}개 파일 업로드 완료</p>
      )}
      {error && <p className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
    </>
  );
}
