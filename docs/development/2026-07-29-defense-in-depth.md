# 2026-07-29 심층 방어 보완

## 확인한 위험

- 운영 Origin 검사에서 요청 URL의 Host를 함께 신뢰해, 프록시/직접 연결 설정 오류가 있으면 Host 기반 우회 여지가 있었다.
- 퀴즈 무결성 IP가 신뢰 설정과 무관하게 `X-Forwarded-For`를 사용해 사용자가 기록을 조작할 수 있었다.
- 외부 연동 URL은 문자열과 IP literal을 차단했지만 DNS가 내부 주소로 해석되는 경우와 DNS 재바인딩을 연결 시점에 차단하지 않았다.
- 인스턴스 공급자 JSON 응답 크기에 상한이 없었다.
- 앱·마이그레이션 컨테이너의 root filesystem, capabilities, PID가 기본값이었고 DB 네트워크에 외부 egress가 있었다.
- 컨테이너 이미지와 GitHub Actions가 이동 가능한 태그를 사용했다.

## 조치

- 운영 mutation Origin은 설정된 공개 URL과 정확히 일치해야 한다.
- 인증 rate limit과 퀴즈 무결성 기록이 동일한 신뢰 프록시 IP 해석기를 사용한다.
- Undici 연결 lookup에서 모든 DNS 결과를 검사하고 검증된 공인 주소만 실제 연결에 사용한다.
- 외부 응답의 content type과 streaming byte 상한을 검사한다.
- Compose에 read-only, no-new-privileges, cap-drop, PID 제한, 제한된 tmpfs와 internal DB network를 적용했다.
- Node/PostgreSQL/Postfix는 manifest digest, checkout/setup-node/gitleaks는 commit SHA로 고정했다.
- 요청 신뢰, DNS 주소 분류, 혼합 DNS 응답, 응답 크기, 컨테이너·공급망 정책 회귀 테스트를 추가했다.

## 운영 영향

- `NEXT_PUBLIC_APP_URL`이 없거나 실제 공개 Origin과 다르면 운영 mutation API는 fail-closed로 403을 반환한다.
- allowlist 도메인이 사설·예약 IP도 함께 반환하면 외부 연동이 실패한다. split DNS가 필요하면 공개 서비스와 내부 서비스를 분리해야 한다.
- 이미지·Action 업데이트는 digest/SHA 갱신 PR로 명시적으로 수행한다.
- Docker Compose 실제 기동 검증은 앱 서버가 복구된 뒤 이슈 #100의 백업·배포·smoke test와 함께 수행한다.
