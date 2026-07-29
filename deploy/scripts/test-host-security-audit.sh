#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
script="$script_dir/audit-host-security.sh"
temporary_directory=$(mktemp -d)
trap 'rm -rf "$temporary_directory"' EXIT

fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }

stub_directory="$temporary_directory/bin"
system_root="$temporary_directory/root"
mkdir -p "$stub_directory" "$system_root/etc/nginx" "$system_root/var/log/nginx" \
  "$system_root/etc/logrotate.d" "$system_root/etc/flow-task"
for command_name in sshd ufw id nginx certbot getenforce aa-status systemctl fail2ban-client apt-get; do
  install -m 0755 "$script_dir/test-host-security-audit-command.stub" "$stub_directory/$command_name"
done
touch "$system_root/etc/nginx/nginx.conf" "$system_root/var/log/nginx/access.log" \
  "$system_root/etc/logrotate.d/nginx"
chmod 0644 "$system_root/etc/nginx/nginx.conf" "$system_root/etc/logrotate.d/nginx"
chmod 0640 "$system_root/var/log/nginx/access.log"
printf '%s\n' 'PROXY_SOURCE=10.0.0.12' 'APP_PORT=3000' > "$system_root/etc/flow-task/firewall.conf"
chmod 0600 "$system_root/etc/flow-task/firewall.conf"

result=$(PATH="$stub_directory:$PATH" FLOW_TASK_SYSTEM_ROOT="$system_root" \
  WAF_PROVIDER=cloudflare sh "$script" proxy)
printf '%s\n' "$result" | grep -q '^SUMMARY pass=11 fail=0 warn=1$' ||
  fail "expected eleven passes and one AppArmor profile warning"

if PATH="$stub_directory:$PATH" FLOW_TASK_SYSTEM_ROOT="$system_root" \
  STUB_RESTRICTED_SSH=false WAF_PROVIDER=cloudflare sh "$script" proxy \
  > "$temporary_directory/unrestricted.result"; then
  fail "globally exposed SSH passed the audit"
fi
grep -q '^FAIL 4 ' "$temporary_directory/unrestricted.result" ||
  fail "SSH source restriction failure not reported"
grep -q '^FAIL 2 ' "$temporary_directory/unrestricted.result" ||
  fail "global SSH rule was not rejected by the role allowlist"

if PATH="$stub_directory:$PATH" FLOW_TASK_SYSTEM_ROOT="$system_root" \
  STUB_UNEXPECTED_UFW=true WAF_PROVIDER=cloudflare sh "$script" proxy \
  > "$temporary_directory/unexpected-ufw.result"; then
  fail "unexpected public database rule passed the audit"
fi
grep -q '^FAIL 2 ' "$temporary_directory/unexpected-ufw.result" ||
  fail "unexpected public rule not reported"

if PATH="$stub_directory:$PATH" FLOW_TASK_SYSTEM_ROOT="$system_root" \
  STUB_DUPLICATE_UFW=true WAF_PROVIDER=cloudflare sh "$script" proxy \
  > "$temporary_directory/duplicate-ufw.result"; then
  fail "duplicate firewall rule passed the audit"
fi
grep -q '^FAIL 2 ' "$temporary_directory/duplicate-ufw.result" ||
  fail "duplicate firewall rule not reported"

if PATH="$stub_directory:$PATH" FLOW_TASK_SYSTEM_ROOT="$system_root" \
  STUB_DEFAULT_INCOMING=allow WAF_PROVIDER=cloudflare sh "$script" proxy \
  > "$temporary_directory/default-allow.result"; then
  fail "default-allow incoming policy passed the audit"
fi
grep -q '^FAIL 2 ' "$temporary_directory/default-allow.result" ||
  fail "default-allow incoming policy not reported"

if PATH="$stub_directory:$PATH" FLOW_TASK_SYSTEM_ROOT="$system_root" \
  STUB_ZERO_PREFIX_SSH=true WAF_PROVIDER=cloudflare sh "$script" proxy \
  > "$temporary_directory/zero-prefix-ssh.result"; then
  fail "zero-prefix SSH source passed the audit"
fi
grep -q '^FAIL 2 ' "$temporary_directory/zero-prefix-ssh.result" ||
  fail "zero-prefix SSH source not rejected by role allowlist"
grep -q '^FAIL 4 ' "$temporary_directory/zero-prefix-ssh.result" ||
  fail "zero-prefix SSH source not rejected as a source restriction"

app_result=$(PATH="$stub_directory:$PATH" FLOW_TASK_SYSTEM_ROOT="$system_root" \
  STUB_UFW_ROLE=app WAF_PROVIDER=cloudflare sh "$script" app)
printf '%s\n' "$app_result" | grep -q '^SUMMARY pass=11 fail=0 warn=1$' ||
  fail "app role allowlist did not pass"

chmod 0664 "$system_root/etc/nginx/nginx.conf"
if PATH="$stub_directory:$PATH" FLOW_TASK_SYSTEM_ROOT="$system_root" \
  WAF_PROVIDER=cloudflare sh "$script" proxy > "$temporary_directory/insecure-mode.result"; then
  fail "group-writable Nginx configuration passed the audit"
fi
grep -q '^FAIL 7 ' "$temporary_directory/insecure-mode.result" ||
  fail "insecure file mode not reported"

chmod 0644 "$system_root/etc/nginx/nginx.conf"
if PATH="$stub_directory:$PATH" FLOW_TASK_SYSTEM_ROOT="$system_root" \
  STUB_APT_SUCCESS=false WAF_PROVIDER=cloudflare sh "$script" proxy \
  > "$temporary_directory/apt-failure.result"; then
  fail "failed package simulation passed the audit"
fi
grep -q '^FAIL 12 package upgrade simulation failed' "$temporary_directory/apt-failure.result" ||
  fail "package simulation failure not reported"

if PATH="$stub_directory:$PATH" FLOW_TASK_SYSTEM_ROOT="$system_root" \
  STUB_APT_MALFORMED=true WAF_PROVIDER=cloudflare sh "$script" proxy \
  > "$temporary_directory/apt-malformed.result"; then
  fail "unparseable package simulation passed the audit"
fi
grep -q '^FAIL 12 package upgrade simulation failed' "$temporary_directory/apt-malformed.result" ||
  fail "unparseable package state not reported"

if PATH="$stub_directory:$PATH" FLOW_TASK_SYSTEM_ROOT="$system_root" \
  STUB_APT_HELD=true WAF_PROVIDER=cloudflare sh "$script" proxy \
  > "$temporary_directory/apt-held.result"; then
  fail "held package updates passed the audit"
fi
grep -q '^FAIL 12 automatic updates disabled or 2 package upgrades pending' \
  "$temporary_directory/apt-held.result" || fail "held package updates not counted"

printf '%s\n' "Host security audit tests passed."
