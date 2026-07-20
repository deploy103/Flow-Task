"use client";

import { useState } from "react";

function bytes(value: string) { const padding = "=".repeat((4 - value.length % 4) % 4); const raw = atob((value + padding).replaceAll("-", "+").replaceAll("_", "/")); return Uint8Array.from([...raw].map((character) => character.charCodeAt(0))); }

export function PushSubscribe({ publicKey }: { publicKey?: string }) {
  const [message, setMessage] = useState("");
  const subscribe = async () => {
    if (!publicKey || !("serviceWorker" in navigator) || !("PushManager" in window)) { setMessage("이 브라우저 또는 서버는 웹 푸시를 사용할 수 없습니다."); return; }
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(publicKey) });
      const response = await fetch("/api/web-push-subscriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(subscription), credentials: "same-origin" });
      setMessage(response.ok ? "이 기기의 웹 푸시를 등록했습니다." : "웹 푸시 등록에 실패했습니다.");
    } catch { setMessage("알림 권한이 거부되었거나 등록에 실패했습니다."); }
  };
  return <div><button className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold" onClick={subscribe} type="button">이 기기 웹 푸시 등록</button>{message && <p className="mt-2 text-xs text-slate-500" role="status">{message}</p>}</div>;
}
