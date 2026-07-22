import Link from "next/link";
import { PRIVACY_POLICY_VERSION } from "@/constants/privacy";

const sections = [
  {
    title: "1. 처리하는 개인정보와 목적",
    content: [
      "필수 정보인 이름, 이메일 주소, 생년월일은 회원 식별, 이메일 인증, 만 14세 이상 확인과 서비스 제공에 사용합니다.",
      "비밀번호 원문은 저장하지 않으며, 무작위 salt를 사용한 단방향 해시 인증정보만 로그인에 사용합니다. 학번은 사용자가 선택한 경우에만 조직 활동 식별에 사용합니다.",
      "서비스 보안과 오남용 방지를 위해 세션 식별자의 해시, 이메일·접속 출처의 복원 불가능한 해시, 감사·접속 기록을 처리할 수 있습니다.",
    ],
  },
  {
    title: "2. 보유 및 파기",
    content: [
      "회원 정보는 회원 탈퇴 요청의 처리가 끝날 때까지 보유하고, 이후 복구할 수 없도록 삭제합니다. 법령에 별도 보존 의무가 있는 정보는 해당 기간에만 분리 보관합니다.",
      "인증·비밀번호 재설정 링크는 정해진 유효기간이 지나거나 사용되면 무효화하며, 원문 대신 해시만 저장합니다.",
    ],
  },
  {
    title: "3. 처리위탁과 외부 서비스",
    content: [
      "이메일 인증과 비밀번호 재설정 메일 발송을 위해 이메일 발송 서비스 Resend에 수신 이메일 주소, 이름과 일회용 링크를 전달합니다. 해당 정보는 메일 전달 목적으로만 사용합니다.",
      "운영자가 새로운 외부 처리업체를 사용하거나 처리 내용이 중요하게 바뀌면 이 방침을 통해 공개합니다.",
    ],
  },
  {
    title: "4. 이용자의 권리와 동의 거부",
    content: [
      "이용자는 자신의 개인정보 열람·정정·삭제·처리정지를 서비스 관리자에게 요청할 수 있습니다.",
      "필수 개인정보 수집·이용 동의를 거부할 수 있지만, 회원 식별과 인증에 필요한 정보이므로 거부하면 가입할 수 없습니다. 선택 정보인 학번은 입력하지 않아도 가입할 수 있습니다.",
      "Flow Task는 법정대리인 동의 절차를 제공하지 않으므로 만 14세 미만 사용자의 가입을 받지 않습니다.",
    ],
  },
  {
    title: "5. 안전성 확보와 문의",
    content: [
      "비밀번호·토큰 해시, 접근 권한 분리, 입력 검증, 요청 횟수 제한과 비공개 저장소 등 필요한 보호조치를 적용합니다.",
      "개인정보 관련 요청과 문의는 가입한 조직의 관리자 또는 Flow Task 운영 관리자에게 전달해 주세요. 운영자는 본인 확인 후 지체 없이 처리합니다.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-12">
      <Link href="/" className="text-sm font-bold text-indigo-600">FLOW TASK</Link>
      <h1 className="mt-5 text-3xl font-bold">개인정보처리방침</h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">Flow Task는 실제 서비스 구조에 맞춰 필요한 최소한의 개인정보만 처리합니다. 시행일 및 버전: {PRIVACY_POLICY_VERSION}</p>
      <div className="mt-8 space-y-8">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-xl font-bold">{section.title}</h2>
            <div className="mt-3 space-y-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
              {section.content.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
          </section>
        ))}
      </div>
      <Link href="/signup" className="mt-10 inline-flex min-h-11 items-center rounded-xl bg-indigo-600 px-4 font-semibold text-white">회원가입으로 돌아가기</Link>
    </main>
  );
}
