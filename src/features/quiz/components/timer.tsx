"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { submitQuizAttempt } from "../attempt-actions";

export function QuizTimer({ expiresAt, context }: { expiresAt: string; context: { organizationId: string; assignmentId: string; quizId: string; attemptId: string } }) {
  const formRef = useRef<HTMLFormElement>(null);
  const remaining = useCallback(() => Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)), [expiresAt]);
  const [seconds, setSeconds] = useState(remaining);
  const lastSubmittedAt = useRef(0);
  useEffect(() => {
    const interval = setInterval(() => {
      const next = remaining();
      setSeconds(next);
      if (next === 0 && Date.now() - lastSubmittedAt.current >= 10_000) {
        lastSubmittedAt.current = Date.now();
        formRef.current?.requestSubmit();
      }
    }, 1_000);
    return () => clearInterval(interval);
  }, [remaining]);
  return <div className="rounded-xl bg-amber-50 px-4 py-3 font-bold text-amber-800"><span>남은 시간 {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</span><form action={submitQuizAttempt} ref={formRef}>{Object.entries(context).map(([name, value]) => <input key={name} name={name} type="hidden" value={value} />)}<input name="automatic" type="hidden" value="true" /></form></div>;
}
