"use client";

import { Button } from "@/components/ui/button";
import { useSubmissionUpload } from "./submission-upload-context";

export function SubmissionActionButtons({ disabled }: { disabled: boolean }) {
  const { uploading } = useSubmissionUpload();
  const actionDisabled = disabled || uploading;
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button
        className="bg-slate-600 hover:bg-slate-700"
        disabled={actionDisabled}
        name="intent"
        type="submit"
        value="draft"
      >
        임시 저장
      </Button>
      <Button
        disabled={actionDisabled}
        name="intent"
        onClick={(event) => {
          if (!window.confirm("최종 제출하시겠습니까?\n수정하면 새 제출 버전이 생성됩니다.")) {
            event.preventDefault();
          }
        }}
        type="submit"
        value="submit"
      >
        {uploading ? "파일 업로드 중" : "최종 제출"}
      </Button>
    </div>
  );
}
