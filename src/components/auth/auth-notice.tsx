const ERROR_MESSAGES: Record<string, string> = {
  invalid_input: "입력한 내용을 다시 확인해 주세요.",
  invalid_credentials: "이메일 또는 비밀번호가 올바르지 않습니다.",
  signup_failed: "가입할 수 없습니다. 잠시 후 다시 시도해 주세요.",
  profile_creation_failed: "프로필을 만들 수 없습니다. 관리자에게 문의해 주세요.",
  profile_recovery_failed: "프로필을 복구할 수 없습니다. 잠시 후 다시 로그인해 주세요.",
  profile_missing: "프로필 정보를 찾을 수 없습니다. 관리자에게 문의해 주세요.",
};

export function AuthNotice({ error, message }: { error?: string; message?: string }) {
  if (error) {
    return (
      <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
        {ERROR_MESSAGES[error] ?? "요청을 처리할 수 없습니다."}
      </p>
    );
  }
  if (message === "check_email") {
    return <p className="mt-5 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-700">이메일 인증 후 로그인해 주세요.</p>;
  }
  return null;
}
