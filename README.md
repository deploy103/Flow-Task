# Flow Task

동아리·학생회·프로젝트팀을 위한 조직 및 과제 관리 서비스입니다.

## 현재 구현 범위

- Supabase Auth 이메일 회원가입, 로그인, 로그아웃, 이메일 인증 콜백
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

## 로컬 실행

Node.js 24와 PostgreSQL 또는 Supabase PostgreSQL이 필요합니다.

```bash
npm install
cp .env.example .env.local
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

`.env.local`에는 실제 개발 환경의 값만 넣고 Git에 커밋하지 않습니다. Supabase Auth의 Redirect URL에는 `http://localhost:3000/auth/callback`을 등록합니다.

파일 제출을 사용하려면 Supabase Storage에 `.env.local`의 `SUBMISSION_STORAGE_BUCKET`과 같은 이름으로 비공개 버킷을 생성해야 합니다. `SUPABASE_SERVICE_ROLE_KEY`는 서버 런타임에서만 사용하며 공개 환경변수나 브라우저 코드에 넣지 않습니다. 서버는 업로드와 다운로드 때마다 버킷의 비공개 설정을 확인합니다.

## 검사

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

## 보안 구조

- 브라우저는 Supabase Auth에만 접근하며 애플리케이션 데이터는 서버의 Prisma 계층을 통합니다.
- 애플리케이션 테이블에는 RLS를 활성화하고 Data API 정책을 만들지 않아 브라우저 직접 접근을 차단합니다.
- 초대 코드 원문은 발급 시 한 번만 표시하며 DB에는 pepper가 포함된 SHA-256 해시만 저장합니다.
- 조직 변경 작업은 세션의 사용자, 조직 소속, 조직 내 역할을 서버에서 다시 확인합니다.
- 제출 파일은 공개 URL 없이 저장하고, 다운로드 요청마다 활성 소속·소유권·관리 권한을 다시 확인합니다.
- 제출 수정은 기존 레코드를 덮어쓰지 않고 새 버전을 만들며 모든 상태 변경을 감사 로그에 기록합니다.
- 비밀값, 운영 설정, 사용자 데이터는 저장소에 포함하지 않습니다.

Docker Compose 예시는 [deploy/docker-compose.example.yml](deploy/docker-compose.example.yml)에 있습니다. DB 포트는 호스트에 공개하지 않습니다.
