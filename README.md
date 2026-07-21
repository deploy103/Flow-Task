# Flow Task

동아리·학생회·프로젝트팀을 위한 조직 및 과제 관리 서비스입니다.

## 현재 구현 범위

- PostgreSQL 기반 이메일 회원가입·로그인과 해시 비밀번호·DB 세션
- 사용자 프로필 조회 및 수정
- 조직 생성과 조직 전환
- 만료일·최대 사용 횟수가 있는 초대 코드 가입
- 구성원 목록과 `조직 관리자 / 멘토 / 부원` 역할 관리
- 시스템 관리자와 조직별 권한 분리, 서버 권한 재검사
- 관리자 작업 감사 로그
- 조직별 공지 작성, 대상 지정, 확인자·미확인자 조회
- 일반 과제 생성, 대상 지정, 공개일·마감일과 지각 제출 설정
- 텍스트·링크·파일 임시 저장과 최종 제출
- 제출 수정 시 기존 내용을 보존하는 버전 관리
- 비공개 파일 저장과 소유자·조직 관리자 권한 검사 다운로드
- 과제별 제출 현황, 관리자 검토, 피드백·점수와 CSV 다운로드
- 새 공지·과제·검토 결과, 마감 임박·미제출 사이트 내부 알림
- 조직 일정 등록·수정·보관과 과제 마감 월간 달력
- 전체·멘토·담당 멘토 질문, 답변·상태·해결 답변 채택과 비공개 첨부파일
- DreamHack·외부 워게임 문제 구성, HMAC 플래그 자동 채점, 풀이·라이트업 제출과 문제별 현황
- 정적 파일·공용 서버형 자체 CTF 문제, 힌트, 비공개 문제 자료와 플래그 자동 채점
- 문제은행 기반 온라인 퀴즈, 6개 문항 유형, 문항별 자동 저장, 제한 시간·응시 횟수, 자동·수동 채점
- 원격 격리 제공자 기반 개인 CTF 인스턴스, Discord·이메일·웹 푸시 알림, 외부 API 연동
- 관리자 통계 대시보드와 Excel 내보내기, 퀴즈 무결성 참고 기록, 설치 가능한 PWA

## 로컬 실행

Node.js 24와 PostgreSQL이 필요합니다. 회원가입과 파일 저장에 외부 서비스는 필요하지 않습니다.

```bash
npm install
cp .env.example .env.local
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

`.env.local`에는 실제 개발 환경의 값만 넣고 Git에 커밋하지 않습니다. `LOCAL_STORAGE_ROOT`에는 애플리케이션 프로세스만 읽고 쓸 수 있는 절대 경로를 지정합니다.

파일은 정적 공개 경로 밖의 로컬 비공개 저장소에 무작위 경로로 저장합니다. 서버는 업로드 전 접근 권한·요청 크기·rate limit·quota·MIME·파일 시그니처를 검사하고, 제출 연결 전에 저장된 실제 크기와 시그니처를 다시 확인합니다. Docker Compose는 `local_storage` 영구 볼륨을 `/app/data/uploads`에 연결합니다.

질문과 답변 첨부파일도 같은 로컬 비공개 저장소를 사용합니다. 전역 Server Action 1MB 제한보다 작은 512KB로 제한하며 확장자·MIME·파일 시그니처를 검증하고, 다운로드 요청마다 질문 게시판 공개 범위와 조직 소속을 다시 확인합니다.

외부 문제의 정답 플래그를 사용하려면 32자 이상의 무작위 `CHALLENGE_FLAG_PEPPER`를 설정해야 합니다. 정답 원문은 저장하지 않고 이 서버 전용 pepper를 사용한 HMAC-SHA256 digest만 저장합니다. 운영 중 pepper를 바꾸면 기존 플래그를 다시 등록해야 하므로 비밀 저장소에서 안전하게 유지합니다.

자체 CTF 문제 자료도 같은 로컬 비공개 저장소에 무작위 경로로 저장합니다. 초기 버전은 Server Action 전역 제한보다 작은 파일 하나(최대 512KB)를 지원하며, 실행 파일은 허용된 ZIP 형식으로 묶어 등록해야 합니다. 다운로드 요청마다 활성 조직 소속, 과제 대상, 공개일과 검토 권한을 다시 검사합니다. 공용 서버형은 시스템이 서버에 접속하지 않고 관리자가 등록한 프로토콜·호스트·포트만 대상자에게 제공합니다.

온라인 퀴즈는 단일·복수 선택, 단답형, 서술형, 플래그, 파일 답안을 지원합니다. 문제와 선택지 순서는 응시 시작 시 스냅샷으로 고정하고 문항별 답안을 자동 저장하며, 제한 시간 만료 시 자동 제출합니다. 단답형과 플래그 정답도 `CHALLENGE_FLAG_PEPPER`로 도메인 분리된 HMAC-SHA256 digest만 저장합니다. 파일 답안은 같은 로컬 비공개 저장소의 무작위 경로에 최대 512KB로 저장하고, 소유자 또는 활성 검토자만 다운로드할 수 있습니다.

개인 CTF 인스턴스는 애플리케이션 서버의 Docker socket을 사용하지 않습니다. `INSTANCE_PROVIDER_URL`의 HTTPS 원격 격리 제공자에 운영자가 미리 승인한 불투명 템플릿 ID와 CPU·메모리·수명 상한만 전달합니다. 제공자 호스트는 `EXTERNAL_SERVICE_ALLOWED_HOSTS`에 등록해야 하며 인스턴스 제공자도 전달받은 수명 뒤 컨테이너를 강제 종료해야 합니다.

외부 알림은 `INTEGRATION_ENCRYPTION_KEY`로 조직별 Discord Webhook·이메일 릴레이·일반 Webhook 주소와 자격 증명을 AES-256-GCM 암호화해 저장합니다. `NOTIFICATION_DELIVERY_SECRET`으로 보호된 `/api/internal/maintenance/notification-deliveries`를 주기 호출하면 전달 큐가 이메일, Web Push, Discord를 최대 5회 재시도합니다. Web Push에는 `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `WEB_PUSH_SUBJECT`가 필요합니다. 실제 URL·키·Webhook은 저장소에 커밋하지 않습니다.

`Notification delivery` 워크플로를 사용하려면 GitHub Actions Secret `NOTIFICATION_DELIVERY_URL`에 배포된 HTTPS API 전체 주소를, `NOTIFICATION_DELIVERY_SECRET`에 서버와 같은 비밀값을 등록합니다. 워크플로는 리다이렉트와 HTTPS 외 프로토콜을 거부하고 5분마다 전달 큐를 처리합니다.

퀴즈의 탭 숨김, 창 이탈, 복사·붙여넣기, IP 변경은 관리자 참고 기록일 뿐 자동 부정행위 판정이나 제재에 사용하지 않습니다. IP 원문은 저장하지 않고 `CHALLENGE_FLAG_PEPPER`로 도메인 분리한 HMAC digest만 기록합니다. PWA 서비스 워커는 인증 HTML과 API 응답을 캐시하지 않고 동일 출처 정적 자산만 캐시합니다.

업로드된 파일은 15분 안에 제출에 연결해야 하며 사용자별 10분당 요청 횟수·누적 용량과 조직별 누적·대기 용량 제한을 적용합니다. 업로드 기한과 10분의 정리 유예가 지난 미소비 파일은 사용자 소속이나 과제 상태와 무관한 janitor가 정리합니다. 삭제 실패는 DB에 횟수·시각·안전한 오류 코드를 기록하고 다음 실행에서 재시도합니다.

주기 정리를 사용하려면 애플리케이션에 32자 이상의 `SUBMISSION_CLEANUP_SECRET`을 설정하고 GitHub Actions Secret `SUBMISSION_CLEANUP_SECRET`에도 같은 값을 등록합니다. `SUBMISSION_CLEANUP_URL`에는 HTTPS를 사용하는 배포된 `/api/internal/maintenance/submission-uploads` 전체 URL을 등록합니다. `Submission upload cleanup` 워크플로는 HTTP URL과 리다이렉트를 거부하고, 정확한 HTTP 200 및 `success: true`, `failed: 0` 응답을 확인하며 15분마다 실행됩니다. 설정 누락, 인증 실패, 리다이렉트, 서버 오류, 일부 삭제 실패는 모두 Workflow 실패로 관측됩니다.

`SYSTEM_ADMIN` 역할이 지정된 계정은 `/admin`에서 서버·DB 상태, 가입자와 조직 수, 알림 및 업로드 정리 작업, 인스턴스, 저장소 사용량, 최근 오류와 감사 로그를 확인할 수 있습니다. 관리자 화면은 비밀번호·플래그·Webhook 비밀값과 사용자 제출 내용 같은 민감 정보를 표시하지 않습니다. 시스템 관리자 승격은 운영 DB에서 검증된 계정에만 명시적으로 적용해야 합니다.

## 검사

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

## 보안 구조

- 비밀번호는 랜덤 salt가 포함된 scrypt 해시로만 저장하고 세션 토큰도 SHA-256 해시만 DB에 저장합니다.
- 인증 쿠키는 `HttpOnly`, `SameSite=Lax`, 운영 환경의 `Secure` 속성을 사용합니다.
- 애플리케이션 테이블에는 RLS를 활성화하고 Data API 정책을 만들지 않아 브라우저 직접 접근을 차단합니다.
- 초대 코드 원문은 발급 시 한 번만 표시하며 DB에는 pepper가 포함된 SHA-256 해시만 저장합니다.
- 조직 변경 작업은 세션의 사용자, 조직 소속, 조직 내 역할을 서버에서 다시 확인합니다.
- 제출 파일은 공개 URL 없이 저장하고, 다운로드 요청마다 활성 소속·소유권·관리 권한을 다시 확인합니다.
- 제출 수정은 기존 레코드를 덮어쓰지 않고 새 버전을 만들며 모든 상태 변경을 감사 로그에 기록합니다.
- 비밀값, 운영 설정, 사용자 데이터는 저장소에 포함하지 않습니다.

Docker Compose 예시는 [deploy/docker-compose.example.yml](deploy/docker-compose.example.yml)에 있습니다. DB 포트는 호스트에 공개하지 않습니다.

최초 시스템 관리자는 마이그레이션 완료 후 운영 서버의 `deploy` 디렉터리에서 다음처럼 생성합니다. 비밀번호는 셸 기록이나 파일에 남기지 말고 일시적인 환경변수로만 전달합니다.

```bash
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='replace-me' ADMIN_NAME=관리자 \
  docker compose run --rm -T migrate node deploy/scripts/bootstrap-system-admin.mjs
```

PostgreSQL과 로컬 업로드 볼륨은 `deploy/scripts/backup-local-data.sh`로 함께 백업합니다. 기본 보관 위치는 `/home/flow/backups/flow-task`, 보관 기간은 서버 용량을 고려한 2일이며 운영 서버에서 매일 실행하도록 예약합니다.
