import { getAuthEmailEnvironment } from "@/lib/env";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

async function sendAuthEmail(to: string, subject: string, text: string, html: string) {
  const environment = getAuthEmailEnvironment();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${environment.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: environment.AUTH_EMAIL_FROM, to: [to], subject, text, html }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`AUTH_EMAIL_DELIVERY_FAILED_${response.status}`);
}

export async function sendVerificationEmail(to: string, name: string, verificationLink: string) {
  const safeName = escapeHtml(name);
  const safeLink = escapeHtml(verificationLink);
  await sendAuthEmail(
    to,
    "[Flow Task] 이메일을 인증해 주세요",
    `${name}님, 다음 링크에서 이메일 인증을 완료해 주세요. 링크는 24시간 동안 유효합니다.\n${verificationLink}`,
    `<p>${safeName}님, Flow Task 가입을 환영합니다.</p><p><a href="${safeLink}">이메일 인증 완료하기</a></p><p>이 링크는 24시간 동안 한 번만 사용할 수 있습니다.</p>`,
  );
}

export async function sendPasswordResetEmail(to: string, name: string, resetLink: string) {
  const safeName = escapeHtml(name);
  const safeLink = escapeHtml(resetLink);
  await sendAuthEmail(
    to,
    "[Flow Task] 비밀번호를 재설정해 주세요",
    `${name}님, 다음 링크에서 비밀번호를 재설정해 주세요. 링크는 30분 동안 유효합니다. 본인이 요청하지 않았다면 이 메일을 무시하세요.\n${resetLink}`,
    `<p>${safeName}님, 비밀번호 재설정 요청을 받았습니다.</p><p><a href="${safeLink}">새 비밀번호 설정하기</a></p><p>이 링크는 30분 동안 한 번만 사용할 수 있습니다. 본인이 요청하지 않았다면 이 메일을 무시하세요.</p>`,
  );
}
