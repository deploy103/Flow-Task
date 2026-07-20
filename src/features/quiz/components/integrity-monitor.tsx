"use client";

import { useEffect } from "react";

type IntegrityType = "TAB_HIDDEN" | "WINDOW_BLUR" | "COPY" | "PASTE";

export function QuizIntegrityMonitor({ attemptId }: { attemptId: string }) {
  useEffect(() => {
    const send = (type: IntegrityType) => { void fetch("/api/quiz-integrity-events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attemptId, type, occurredAt: new Date().toISOString() }), credentials: "same-origin", keepalive: true }); };
    const visibility = () => { if (document.visibilityState === "hidden") send("TAB_HIDDEN"); };
    const blur = () => send("WINDOW_BLUR");
    const copy = () => send("COPY");
    const paste = () => send("PASTE");
    document.addEventListener("visibilitychange", visibility); window.addEventListener("blur", blur); document.addEventListener("copy", copy); document.addEventListener("paste", paste);
    return () => { document.removeEventListener("visibilitychange", visibility); window.removeEventListener("blur", blur); document.removeEventListener("copy", copy); document.removeEventListener("paste", paste); };
  }, [attemptId]);
  return null;
}
