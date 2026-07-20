"use client";

import { useActionState } from "react";
import { MembershipRole } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { createInvitation, type InvitationActionState } from "../actions";

const initialState: InvitationActionState = { success: false };

export function InvitationForm({ organizationId }: { organizationId: string }) {
  const [state, formAction, pending] = useActionState(createInvitation, initialState);

  return (
    <div>
      <form action={formAction} className="grid gap-3 sm:grid-cols-3">
        <input type="hidden" name="organizationId" value={organizationId} />
        <label className="text-sm font-medium">
          가입 역할
          <select name="role" defaultValue={MembershipRole.MEMBER} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900">
            <option value={MembershipRole.MEMBER}>부원</option>
            <option value={MembershipRole.MENTOR}>멘토</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          유효 기간
          <select name="expiresInDays" defaultValue="7" className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900">
            <option value="1">1일</option>
            <option value="7">7일</option>
            <option value="14">14일</option>
            <option value="30">30일</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          최대 사용 인원
          <input name="maxUses" type="number" min="1" max="500" defaultValue="30" required className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900" />
        </label>
        <Button type="submit" disabled={pending} className="sm:col-span-3">
          {pending ? "발급 중..." : "초대 코드 발급"}
        </Button>
      </form>
      {state.message && (
        <div aria-live="polite" className={`mt-4 rounded-xl p-4 text-sm ${state.success ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200" : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200"}`}>
          {state.invitationCode && <p className="mb-2 select-all font-mono text-xl font-black tracking-widest">{state.invitationCode}</p>}
          <p>{state.message}</p>
        </div>
      )}
    </div>
  );
}
