"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
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
import { useSubmissionUpload } from "./submission-upload-context";

type UploadedFile = {
  uploadId: string;
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
  const uploadIdsRef = useRef<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { uploading, setUploading } = useSubmissionUpload();
  const endpoint = `/api/organizations/${organizationId}/assignments/${assignmentId}/submission-uploads`;

  function setTrackedUploads(nextUploads: { id: string; name: string }[]) {
    uploadIdsRef.current = nextUploads.map(({ id }) => id);
    setUploads(nextUploads);
  }

  useEffect(() => {
    const cancelOnPageExit = () => {
      if (!uploadIdsRef.current.length) return;
      void fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadIds: uploadIdsRef.current }),
        keepalive: true,
      });
    };
    window.addEventListener("pagehide", cancelOnPageExit);
    return () => {
      window.removeEventListener("pagehide", cancelOnPageExit);
      cancelOnPageExit();
    };
  }, [endpoint]);

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
      setTrackedUploads([]);
      for (const file of files) {
        const metadata = validateSubmissionFile(file);
        if (!metadata || !(await hasValidSubmissionFileSignature(file, metadata.extension))) {
          throw new Error("INVALID_FILE");
        }
        const body = new FormData();
        body.set("fieldId", fieldId);
        body.set("file", file);
        const uploadResponse = await fetch(endpoint, {
          method: "POST",
          body,
        });
        const uploadBody = (await uploadResponse.json()) as {
          success: boolean;
          data?: UploadedFile;
        };
        if (!uploadResponse.ok || !uploadBody.success || !uploadBody.data) {
          throw new Error("UPLOAD_FAILED");
        }
        completed.push({ id: uploadBody.data.uploadId, name: metadata.originalFilename });
        setTrackedUploads([...completed]);
      }
    } catch {
      await Promise.allSettled([cancelUploads(completed.map(({ id }) => id))]);
      setTrackedUploads([]);
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
