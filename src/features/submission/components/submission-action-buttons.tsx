"use client";

import { Button } from "@/components/ui/button";

export function SubmissionActionButtons({ disabled }: { disabled: boolean }) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button
        className="bg-slate-600 hover:bg-slate-700"
        disabled={disabled}
        name="intent"
        type="submit"
        value="draft"
      >
        임시 저장
      </Button>
      <Button
        disabled={disabled}
        name="intent"
        onClick={(event) => {
          if (!window.confirm("최종 제출하시겠습니까?\n수정하면 새 제출 버전이 생성됩니다.")) {
            event.preventDefault();
          }
        }}
        type="submit"
        value="submit"
      >
        최종 제출
      </Button>
    </div>
  );
}
