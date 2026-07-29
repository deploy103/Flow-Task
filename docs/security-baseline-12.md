# 서버 기본 보안 점검 가이드

이 문서는 특정 서버의 점검 결과가 아닌 일반적인 운영 체크리스트입니다.
운영 주소, 실제 설정, 취약 상태와 점검 결과는 저장소 밖의 비공개 기록으로 관리하세요.

1. 공개 키 SSH와 비밀번호·root 로그인 제한
2. 역할에 필요한 포트만 방화벽 허용
3. 웹 서비스 계정의 최소 권한
4. SSH 사용자와 관리망 접근 제한
5. 유효한 TLS 인증서와 HTTPS
6. 디렉터리 목록 차단과 경로별 접근 정책
7. 설정·데이터·로그 파일의 최소 권한
8. 강제 접근 통제 정책
9. 로그 수집·회전과 모니터링
10. WAF 정책의 별도 확인
11. 침입 차단과 보안 모니터링
12. 정기 보안 업데이트와 복구 준비

## 재현

root 권한으로 다음 읽기 전용 점검을 실행한다. Cloudflare WAF 규칙이 별도 관리 화면에서 확인된 경우에만 `WAF_PROVIDER=cloudflare`를 명시한다.

```bash
sudo sh deploy/scripts/audit-host-security.sh proxy
sudo WAF_PROVIDER=cloudflare sh deploy/scripts/audit-host-security.sh proxy
sudo sh deploy/scripts/audit-host-security.sh app
```

## 18-b 적용 순서

1. `harden-ssh-access.sh --phase prepare`로 사용자가 보유한 Ed25519 공개 키만 먼저 추가한다.
2. 기존 세션을 유지한 채 새 터미널에서 개인 키 로그인이 성공하고 표시된 fingerprint가 일치하는지 확인한다.
3. `--phase enforce --confirmed-fingerprint ... --apply`로 root/비밀번호/keyboard-interactive 로그인을 차단한다.
4. 관리 VPN의 실제 주소 대역을 확인한 뒤 `harden-host-firewall.sh --role proxy --ssh-source ...`의 계획을 검토한다.
5. UFW 설치 후 방화벽을 적용하되, 스크립트가 예상 외 기존 규칙을 발견하면 자동 삭제하지 말고 중단한다.
6. 운영 설정과 데이터를 백업한 뒤 패키지를 업데이트하고 재부팅 필요 여부를 확인한다.
7. Cloudflare 관리 화면에서 WAF managed rules를 확인한다.
8. 두 번째 키 로그인, HTTP→HTTPS, 공개 health, 인증서, Fail2ban, 감사 스크립트를 다시 검증한다.

SSH/UFW/패키지 변경은 원격 접속과 서비스 가용성에 영향을 줄 수 있으므로 PR 리뷰 전에는 적용하지 않는다. 특히 공개 키와 관리 VPN CIDR을 추측해서 적용하지 않는다.

## 저장소 회귀 검사

```bash
sh -n deploy/scripts/audit-host-security.sh deploy/scripts/harden-ssh-access.sh deploy/scripts/harden-host-firewall.sh
sh deploy/scripts/test-host-security-audit.sh
sh deploy/scripts/test-harden-ssh-access.sh
sh deploy/scripts/test-host-firewall.sh
```
