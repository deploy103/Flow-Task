export const PUBLIC_APP_ORIGIN = "https://flow.mvtp.cloud";
export const PUBLIC_LOGIN_URL = `${PUBLIC_APP_ORIGIN}/login`;
export const PUBLIC_SIGNUP_URL = `${PUBLIC_APP_ORIGIN}/signup`;

export const MARKETING_FEATURES = [
  { title: "공지와 마감 확인", description: "공지, 과제, 마감일과 미제출 현황을 한 화면에서 확인합니다." },
  { title: "제출 이력 관리", description: "텍스트·링크·파일 제출과 검토 결과, 재제출 요청을 버전별로 기록합니다." },
  { title: "부서별 소통", description: "부서와 부서장을 지정하고 부서 채팅과 질문 게시판을 운영합니다." },
  { title: "퀴즈와 CTF 운영", description: "온라인 퀴즈와 정적 CTF 문제를 과제에 추가하고 결과를 확인합니다." },
] as const;

export const MARKETING_STEPS = [
  { number: "01", title: "조직 개설 또는 가입", description: "관리자는 조직을 개설하고, 구성원은 12자리 초대 코드로 가입합니다." },
  { number: "02", title: "공지와 과제 등록", description: "공개 대상, 공개일, 마감일과 제출 방식을 설정합니다." },
  { number: "03", title: "진행 현황 확인", description: "구성원은 자신의 할 일을 확인하고, 관리자는 제출과 공지 확인 현황을 점검합니다." },
] as const;
