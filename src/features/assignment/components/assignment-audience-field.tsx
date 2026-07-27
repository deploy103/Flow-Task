"use client";

import { AssignmentAudience } from "@prisma/client";
import { useState } from "react";

type AssignmentMember = {
  id: string;
  name: string;
  email: string;
};

export function AssignmentAudienceField({ members }: { members: AssignmentMember[] }) {
  const [audience, setAudience] = useState<AssignmentAudience>(AssignmentAudience.ALL_MEMBERS);

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium">
        과제 대상
        <select
          className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
          name="audience"
          onChange={(event) => setAudience(event.target.value as AssignmentAudience)}
          value={audience}
        >
          <option value={AssignmentAudience.ALL_MEMBERS}>전체 구성원</option>
          <option value={AssignmentAudience.SELECTED_MEMBERS}>구성원 직접 선택</option>
        </select>
      </label>

      {audience === AssignmentAudience.SELECTED_MEMBERS && (
        <fieldset>
          <legend className="text-sm font-medium">과제를 공개할 구성원</legend>
          <p className="mt-1 text-xs text-slate-500">한 명 이상 선택하세요.</p>
          {members.length ? (
            <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-3 dark:border-slate-700 sm:grid-cols-2">
              {members.map((member) => (
                <label className="flex items-start gap-2 rounded-lg p-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800" key={member.id}>
                  <input className="mt-1" name="targetUserIds" type="checkbox" value={member.id} />
                  <span>
                    <strong className="block">{member.name}</strong>
                    <span className="text-slate-500">{member.email}</span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed p-4 text-sm text-slate-500">선택할 구성원이 없습니다.</p>
          )}
        </fieldset>
      )}
    </div>
  );
}
