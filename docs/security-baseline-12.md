# 서버 기본 보안 12개 항목 점검

기준은 사용자가 지정한 [안전한 웹서버 구축 보안 가이드 12가지](https://couplewith.tistory.com/720)이며, 2026-07-29에 원문 항목과 운영 프록시를 대조했다.

| 번호 | 기준 | 프록시 결과 | 근거 및 18-b 조치 |
|---:|---|---|---|
| 1 | 공개 키 SSH, 비밀번호·root 로그인 차단 | 미준수 | 공개 키는 허용하지만 `PasswordAuthentication yes`. 키를 먼저 추가·별도 로그인 검증한 뒤 비밀번호 인증을 끈다. |
| 2 | 필요한 포트만 방화벽 허용 | 미준수 | UFW가 설치되지 않았다. 리뷰된 역할별 UFW 스크립트로 SSH/80/443만 허용한다. |
| 3 | 웹 서비스 계정 sudo 제한 | 준수 | `www-data`는 sudo/admin 그룹에 없고 관리자 계정만 sudo 그룹에 있다. |
| 4 | SSH 사용자/IP 제한 | 미준수 | 유효 설정에 AllowUsers/AllowGroups가 없고 호스트 방화벽도 없다. SSH 사용자를 제한하고 실제 관리 VPN 대역만 UFW에 허용한다. |
| 5 | SSL 인증서와 HTTPS | 준수 | Nginx TLS 1.2/1.3, `flow.mvtp.cloud` 인증서 유효기간 81일을 확인했다. |
| 6 | Nginx 디렉터리 목록 차단/접근 정책 | 준수 | `autoindex on`이 없어서 기본 off이며 공개 서비스 경로는 IP allowlist 대상이 아니다. |
| 7 | 웹/설정/로그 파일 최소 권한 | 준수 | Nginx 설정은 root 소유 0644, 로그는 www-data:adm 0640이며 group/world-writable 설정·로그가 없다. |
| 8 | SELinux 등 강제 접근 통제 | 부분 준수 | Ubuntu라 SELinux는 없고 대체 MAC인 AppArmor는 활성이다. Nginx/컨테이너별 profile 적용 여부는 추가 확인한다. |
| 9 | 로그 모니터링 | 준수 | journald 활성, Nginx access/error log와 logrotate 설정을 확인했다. |
| 10 | WAF | 확인 필요 | Cloudflare 프록시 경유는 확인했으나 WAF managed rules 활성 여부는 호스트에서 증명할 수 없다. |
| 11 | 침입 차단/보안 모니터링 | 준수 | Fail2ban 활성, sshd jail 1개를 확인했다. |
| 12 | 주기적 보안 업데이트 | 미준수 | unattended-upgrades와 apt timer는 활성이나 업그레이드 대기 패키지가 30개다. 백업 후 업데이트·재부팅 필요 여부를 확인한다. |

앱 서버는 작업 환경과 프록시에서 모두 `No route to host`이고 공개 서비스는 HTTP 502이므로 동일 12개 항목을 확인하지 못했다. 서버 복구 전에는 앱 서버를 준수로 판정하지 않는다.

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
