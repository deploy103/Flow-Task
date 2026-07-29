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
  "$system_root/etc/logrotate.d"
for command_name in sshd ufw id nginx certbot getenforce aa-status systemctl fail2ban-client apt-get; do
  install -m 0755 "$script_dir/test-host-security-audit-command.stub" "$stub_directory/$command_name"
done
touch "$system_root/etc/nginx/nginx.conf" "$system_root/var/log/nginx/access.log" \
  "$system_root/etc/logrotate.d/nginx"
chmod 0644 "$system_root/etc/nginx/nginx.conf" "$system_root/etc/logrotate.d/nginx"
chmod 0640 "$system_root/var/log/nginx/access.log"

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

chmod 0664 "$system_root/etc/nginx/nginx.conf"
if PATH="$stub_directory:$PATH" FLOW_TASK_SYSTEM_ROOT="$system_root" \
  WAF_PROVIDER=cloudflare sh "$script" proxy > "$temporary_directory/insecure-mode.result"; then
  fail "group-writable Nginx configuration passed the audit"
fi
grep -q '^FAIL 7 ' "$temporary_directory/insecure-mode.result" ||
  fail "insecure file mode not reported"

printf '%s\n' "Host security audit tests passed."
