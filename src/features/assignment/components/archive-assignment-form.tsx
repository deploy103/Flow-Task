"use client";

import { Archive } from "lucide-react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { archiveAssignment } from "../actions";

export function ArchiveAssignmentForm({
  assignmentId,
  assignmentTitle,
  organizationId,
}: {
  assignmentId: string;
  assignmentTitle: string;
  organizationId: string;
}) {
  function confirmArchive(event: FormEvent<HTMLFormElement>) {
    if (
      !window.confirm(
        `“${assignmentTitle}” 과제를 삭제할까요?\n제출 기록은 보존되며 과제 목록에서는 숨겨집니다.`,
      )
    ) {
      event.preventDefault();
    }
  }

  return (
    <form action={archiveAssignment} onSubmit={confirmArchive}>
      <input name="organizationId" type="hidden" value={organizationId} />
      <input name="assignmentId" type="hidden" value={assignmentId} />
      <Button className="gap-2 bg-red-600 hover:bg-red-700" type="submit">
        <Archive size={18} /> 과제 삭제
      </Button>
    </form>
  );
}
