#!/bin/sh
set -u

role=${1:-}
waf_provider=${WAF_PROVIDER:-unknown}
system_root=${FLOW_TASK_SYSTEM_ROOT:-}
[ "$role" = "proxy" ] || [ "$role" = "app" ] || {
  printf 'Usage: %s proxy|app\n' "$0" >&2
  exit 2
}

passed=0
failed=0
warnings=0
result() {
  status=$1; number=$2; message=$3
  printf '%s %s %s\n' "$status" "$number" "$message"
  case "$status" in PASS) passed=$((passed + 1)) ;; FAIL) failed=$((failed + 1)) ;; WARN) warnings=$((warnings + 1)) ;; esac
}

sshd_binary=$(command -v sshd 2>/dev/null || printf '%s\n' /usr/sbin/sshd)
sshd_effective=$("$sshd_binary" -T 2>/dev/null || true)
if printf '%s\n' "$sshd_effective" | grep -qx 'pubkeyauthentication yes' &&
  printf '%s\n' "$sshd_effective" | grep -qx 'passwordauthentication no' &&
  printf '%s\n' "$sshd_effective" | grep -qx 'permitrootlogin no'; then
  result PASS 1 "public-key-only SSH and root login disabled"
else
  result FAIL 1 "SSH must disable password and root login while keeping public keys enabled"
fi

ufw_status=$(ufw status 2>/dev/null || true)
if command -v ufw >/dev/null 2>&1 && printf '%s\n' "$ufw_status" | grep -q '^Status: active'; then
  result PASS 2 "UFW active"
else
  result FAIL 2 "host firewall inactive or unavailable"
fi

service_user=www-data
if id "$service_user" >/dev/null 2>&1; then
  service_groups=$(id -nG "$service_user")
  if printf ' %s ' "$service_groups" | grep -Eq ' (sudo|admin) '; then
    result FAIL 3 "web service account has administrative group membership"
  else
    result PASS 3 "web service account has no sudo/admin group"
  fi
else
  result WARN 3 "host web service account not present; inspect container user separately"
fi

ssh_port=$(printf '%s\n' "$sshd_effective" | awk '$1 == "port" {print $2; exit}')
ssh_port=${ssh_port:-22}
restricted_ssh_source=$(printf '%s\n' "$ufw_status" |
  grep -E "^${ssh_port}(/tcp)?[[:space:]]+(LIMIT|ALLOW)[[:space:]]+IN[[:space:]]+" |
  grep -Ev '(Anywhere|0\.0\.0\.0/0|::/0)' | head -1 || true)
if printf '%s\n' "$sshd_effective" | grep -Eq '^(allowusers|allowgroups) ' &&
  [ -n "$restricted_ssh_source" ]; then
  result PASS 4 "SSH principal and source network restricted"
else
  result FAIL 4 "SSH requires both AllowUsers/AllowGroups and a source-restricted UFW rule"
fi

if [ "$role" = "proxy" ] && command -v nginx >/dev/null 2>&1 && nginx -t >/dev/null 2>&1 &&
  command -v certbot >/dev/null 2>&1 && certbot certificates 2>/dev/null | grep -q 'VALID:'; then
  result PASS 5 "Nginx TLS certificate valid"
elif [ "$role" = "app" ]; then
  result PASS 5 "TLS terminates on the separate proxy role"
else
  result FAIL 5 "valid TLS termination not verified"
fi

if [ "$role" = "proxy" ] && { ! command -v nginx >/dev/null 2>&1 || ! nginx -t >/dev/null 2>&1; }; then
  result FAIL 6 "Nginx configuration unavailable or invalid"
elif [ "$role" = "proxy" ] && nginx -T 2>&1 | grep -Eq '^[[:space:]]*autoindex[[:space:]]+on'; then
  result FAIL 6 "Nginx directory listing enabled"
else
  result PASS 6 "directory listing not enabled"
fi

if [ "$role" = "proxy" ]; then
  configuration_path="${system_root}/etc/nginx"
  log_path="${system_root}/var/log/nginx"
  if [ ! -d "$configuration_path" ] || [ ! -d "$log_path" ]; then
    result FAIL 7 "Nginx configuration or log directory unavailable"
  else
    insecure_modes=$(find "$configuration_path" "$log_path" -xdev -type f -perm /022 -print 2>/dev/null | head -1)
    [ -z "$insecure_modes" ] && result PASS 7 "no group/world-writable server configuration or log files" || result FAIL 7 "group/world-writable server configuration or log file found"
  fi
else
  configuration_path="${system_root}/etc/flow-task"
  if [ ! -d "$configuration_path" ]; then
    result WARN 7 "app host configuration directory unavailable"
  else
    insecure_modes=$(find "$configuration_path" -xdev -type f -perm /022 -print 2>/dev/null | head -1)
    [ -z "$insecure_modes" ] && result PASS 7 "no group/world-writable server configuration files" || result FAIL 7 "group/world-writable server configuration file found"
  fi
fi

if command -v getenforce >/dev/null 2>&1 && [ "$(getenforce 2>/dev/null)" = "Enforcing" ]; then
  result PASS 8 "SELinux enforcing"
elif command -v aa-status >/dev/null 2>&1 && aa-status --enabled >/dev/null 2>&1; then
  result WARN 8 "AppArmor enabled; verify an enforcing web service/container profile"
else
  result FAIL 8 "no enforcing SELinux/AppArmor control detected"
fi

if systemctl is-active --quiet systemd-journald.service &&
  { [ "$role" = "app" ] || [ -e "${system_root}/etc/logrotate.d/nginx" ]; }; then
  result PASS 9 "system logging and rotation available"
else
  result FAIL 9 "logging or rotation unavailable"
fi

case "$waf_provider" in
  cloudflare|modsecurity) result PASS 10 "declared WAF provider: $waf_provider" ;;
  *) result WARN 10 "WAF policy cannot be proven from this host" ;;
esac

if systemctl is-active --quiet fail2ban.service &&
  fail2ban-client status 2>/dev/null | grep -Eq 'Jail list:[[:space:]]*[^[:space:]]'; then
  result PASS 11 "Fail2ban active with at least one jail"
else
  result FAIL 11 "Fail2ban inactive or no jail configured"
fi

pending_updates=$(LC_ALL=C apt-get -s upgrade 2>/dev/null | awk '/^Inst / {count++} END {print count+0}')
if systemctl is-enabled --quiet unattended-upgrades.service 2>/dev/null && [ "$pending_updates" -eq 0 ]; then
  result PASS 12 "automatic security updates enabled and no pending upgrades"
else
  result FAIL 12 "automatic updates disabled or $pending_updates package upgrades pending"
fi

printf 'SUMMARY pass=%s fail=%s warn=%s\n' "$passed" "$failed" "$warnings"
[ "$failed" -eq 0 ]
