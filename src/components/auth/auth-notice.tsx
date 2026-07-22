const ERROR_MESSAGES: Record<string, string> = {
  invalid_input: "입력한 내용을 다시 확인해 주세요.",
  invalid_credentials: "이메일 또는 비밀번호가 올바르지 않습니다.",
  rate_limited: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
  signup_failed: "가입할 수 없습니다. 잠시 후 다시 시도해 주세요.",
  email_in_use: "이미 가입된 이메일입니다.",
  email_not_verified: "로그인하려면 먼저 이메일 인증을 완료해 주세요.",
  verification_delivery_failed: "인증 메일을 보내지 못했습니다. 아래에서 다시 요청해 주세요.",
  invalid_or_expired_verification: "인증 링크가 올바르지 않거나 만료되었습니다. 인증 메일을 다시 요청해 주세요.",
  invalid_reset_request: "비밀번호와 비밀번호 확인을 다시 확인해 주세요.",
  invalid_or_expired_token: "재설정 링크가 올바르지 않거나 만료되었습니다. 새 링크를 요청해 주세요.",
  profile_creation_failed: "프로필을 만들 수 없습니다. 관리자에게 문의해 주세요.",
  profile_recovery_failed: "프로필을 복구할 수 없습니다. 잠시 후 다시 로그인해 주세요.",
  profile_missing: "프로필 정보를 찾을 수 없습니다. 관리자에게 문의해 주세요.",
};

const MESSAGE_MESSAGES: Record<string, string> = {
  verification_sent: "가입 여부와 관계없이, 인증이 필요한 계정이라면 메일을 보냈습니다.",
  email_verified: "이메일 인증이 완료되었습니다. 로그인해 주세요.",
  reset_sent: "가입 여부와 관계없이, 사용할 수 있는 계정이라면 재설정 메일을 보냈습니다.",
  password_updated: "비밀번호를 변경했습니다. 새 비밀번호로 로그인해 주세요.",
};

export function AuthNotice({ error, message }: { error?: string; message?: string }) {
  if (error) {
    return (
      <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
        {ERROR_MESSAGES[error] ?? "요청을 처리할 수 없습니다."}
      </p>
    );
  }
  if (message && MESSAGE_MESSAGES[message]) {
    return <p role="status" className="mt-5 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">{MESSAGE_MESSAGES[message]}</p>;
  }
  return null;
}
