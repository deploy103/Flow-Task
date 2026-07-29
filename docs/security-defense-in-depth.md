# 심층 방어 기준

## 요청 신뢰 경계

- 운영 상태 변경 API는 `NEXT_PUBLIC_APP_URL`의 정확한 Origin만 허용한다. 내부 컨테이너 주소나 요청의 Host 값은 운영 신뢰 기준이 아니다.
- 프록시 전달 IP는 `AUTH_TRUST_PROXY=true`이고 프록시가 `X-Real-IP`을 항상 덮어쓰는 경우에만 사용한다.
- `X-Forwarded-For`는 사용자 입력으로 간주하며 보안 제한이나 퀴즈 무결성 증거로 사용하지 않는다.

## 외부 연결

- 외부 webhook과 인스턴스 공급자는 HTTPS·호스트 allowlist 검사를 먼저 통과해야 한다.
- 연결 시 DNS의 모든 A/AAAA 결과가 전역 unicast인지 확인한다. 하나라도 loopback, 사설망, link-local, CGNAT, 예약망 또는 IPv4-mapped 사설 주소이면 연결하지 않는다.
- 검증한 주소를 실제 소켓 lookup 결과로 사용해 DNS 재바인딩의 검사/연결 시간 차이를 제거한다.
- redirect를 허용하지 않으며 timeout을 둔다. 인스턴스 공급자 JSON 응답은 16KiB와 `application/json`으로 제한한다.

## 컨테이너

- 앱과 마이그레이션은 read-only root filesystem, `no-new-privileges`, 모든 capability 제거, PID 제한을 사용한다.
- 쓰기가 필요한 업로드, cache, `/tmp`만 volume/tmpfs로 연다. tmpfs에는 `noexec,nosuid,nodev`를 적용한다.
- DB 네트워크는 `internal`로 두고 앱·마이그레이션·DB만 연결한다. 외부 발송이 필요한 앱과 SMTP만 별도 mail network를 사용하며 앱의 기본 gateway는 mail network로 명시한다.
- 앱은 UID 1001 비-root 사용자로 실행하며 마이그레이션도 숫자 UID/GID 1001로 실행한다.

## 공급망

- Node, PostgreSQL, Postfix 이미지는 태그와 OCI manifest digest를 함께 기록한다.
- GitHub Actions는 릴리스 태그가 아니라 40자리 commit SHA로 고정한다.
- 버전 갱신 시 공식 태그의 현재 digest/SHA를 확인하고, lockfile 갱신·`npm audit`·전체 CI를 같은 PR에서 수행한다.
- digest 고정은 업데이트를 자동 제공하지 않으므로 정기 보안 점검에서 새 digest와 upstream 보안 공지를 확인한다.
