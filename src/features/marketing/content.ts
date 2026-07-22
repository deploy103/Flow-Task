export const PUBLIC_APP_ORIGIN = "https://flow.mvtp.cloud";
export const PUBLIC_LOGIN_URL = `${PUBLIC_APP_ORIGIN}/login`;
export const PUBLIC_SIGNUP_URL = `${PUBLIC_APP_ORIGIN}/signup`;

export const MARKETING_FEATURES = [
  { title: "할 일을 한눈에", description: "공지, 과제, 마감일, 미제출 현황을 한 곳에서 확인해요." },
  { title: "제출과 피드백을 안전하게", description: "텍스트·링크·파일 제출과 버전, 검토, 재제출 요청을 모두 남겨요." },
  { title: "팀에 맞는 협업", description: "부서와 부서장을 정하고, 부서별 채팅과 질문 게시판으로 함께 해결해요." },
  { title: "퀴즈와 보안 문제까지", description: "온라인 퀴즈, CTF, 외부 문제를 과제 안에서 같은 방식으로 운영해요." },
] as const;

export const MARKETING_STEPS = [
  { number: "01", title: "조직을 만들거나 참여해요", description: "관리자는 조직을 만들고, 구성원은 12자리 초대 코드로 쉽게 참여해요." },
  { number: "02", title: "공지와 과제를 등록해요", description: "전체 또는 특정 구성원을 선택하고 공개일·마감일·제출 방식을 정해요." },
  { number: "03", title: "진행 상태를 함께 확인해요", description: "구성원은 할 일에 집중하고, 관리자는 제출·확인·피드백 현황을 놓치지 않아요." },
] as const;
