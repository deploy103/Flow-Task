#!/bin/sh
set -eu

usage() {
  cat <<'EOF'
Usage:
  harden-host-firewall.sh --role proxy [--ssh-source IPv4[/PREFIX]]
                          [--ssh-port PORT] [--apply]
  harden-host-firewall.sh --role app --proxy-source IPv4[/PREFIX]
                          --app-bind-address IPv4
                          [--ssh-source IPv4[/PREFIX]]
                          [--app-port PORT] [--ssh-port PORT] [--apply]

Without --apply, validated UFW commands are printed but no host setting changes.
EOF
}

role=""
proxy_source=""
ssh_source=""
app_bind_address=""
ssh_port="22"
app_port="3000"
apply="false"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --role) [ "$#" -ge 2 ] || { usage >&2; exit 2; }; role=$2; shift 2 ;;
    --proxy-source) [ "$#" -ge 2 ] || { usage >&2; exit 2; }; proxy_source=$2; shift 2 ;;
    --ssh-source) [ "$#" -ge 2 ] || { usage >&2; exit 2; }; ssh_source=$2; shift 2 ;;
    --app-bind-address) [ "$#" -ge 2 ] || { usage >&2; exit 2; }; app_bind_address=$2; shift 2 ;;
    --ssh-port) [ "$#" -ge 2 ] || { usage >&2; exit 2; }; ssh_port=$2; shift 2 ;;
    --app-port) [ "$#" -ge 2 ] || { usage >&2; exit 2; }; app_port=$2; shift 2 ;;
    --apply) apply="true"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'Unknown argument: %s\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
done

valid_port() {
  case "$1" in *[!0-9]*|'') return 1 ;; esac
  [ "$1" -ge 1 ] && [ "$1" -le 65535 ]
}

valid_ipv4_source() {
  printf '%s\n' "$1" | awk -F/ '
    NF < 1 || NF > 2 { exit 1 }
    NF == 2 && ($2 !~ /^[0-9]+$/ || $2 < 0 || $2 > 32) { exit 1 }
    {
      count = split($1, octets, ".")
      if (count != 4) exit 1
      for (i = 1; i <= 4; i++) {
        if (octets[i] !~ /^[0-9]+$/ || octets[i] < 0 || octets[i] > 255) exit 1
      }
    }
  '
}

[ "$role" = "proxy" ] || [ "$role" = "app" ] || {
  printf '%s\n' "--role must be proxy or app." >&2
  exit 2
}
valid_port "$ssh_port" || { printf '%s\n' "Invalid SSH port." >&2; exit 2; }
valid_port "$app_port" || { printf '%s\n' "Invalid application port." >&2; exit 2; }
if [ -n "$ssh_source" ] && ! valid_ipv4_source "$ssh_source"; then
  printf '%s\n' "Invalid --ssh-source." >&2
  exit 2
fi
if [ "$role" = "app" ]; then
  [ -n "$proxy_source" ] && valid_ipv4_source "$proxy_source" || {
    printf '%s\n' "The app role requires a valid --proxy-source." >&2
    exit 2
  }
  [ -n "$app_bind_address" ] && valid_ipv4_source "$app_bind_address" &&
    ! printf '%s\n' "$app_bind_address" | grep -q '/' || {
    printf '%s\n' "The app role requires a single IPv4 --app-bind-address." >&2
    exit 2
  }
fi

expected_rules() {
  if [ -n "$ssh_source" ]; then
    printf 'ufw limit from %s to any port %s proto tcp\n' "$ssh_source" "$ssh_port"
  else
    printf '%s\n' "ufw limit ${ssh_port}/tcp"
  fi
  if [ "$role" = "proxy" ]; then
    printf '%s\n' "ufw allow 80/tcp" "ufw allow 443/tcp"
  else
    printf 'ufw allow from %s to any port %s proto tcp\n' "$proxy_source" "$app_port"
  fi
}

print_plan() {
  printf '%s\n' "ufw default deny incoming" "ufw default allow outgoing"
  if [ -n "$ssh_source" ]; then
    printf 'ufw limit from %s to any port %s proto tcp\n' "$ssh_source" "$ssh_port"
  else
    printf '%s\n' "ufw limit ${ssh_port}/tcp"
  fi
  if [ "$role" = "proxy" ]; then
    printf '%s\n' "ufw allow 80/tcp" "ufw allow 443/tcp"
  else
    printf 'ufw allow from %s to any port %s proto tcp\n' "$proxy_source" "$app_port"
    printf 'install persistent DOCKER-USER policy for %s:%s from %s\n' \
      "$app_bind_address" "$app_port" "$proxy_source"
  fi
  printf '%s\n' "ufw --force enable" "ufw status verbose"
}

if [ "$apply" != "true" ]; then
  print_plan
  exit 0
fi

[ "$(id -u)" -eq 0 ] || { printf '%s\n' "Run --apply as root." >&2; exit 1; }
command -v ufw >/dev/null 2>&1 || { printf '%s\n' "ufw is not installed." >&2; exit 1; }
command -v ss >/dev/null 2>&1 || { printf '%s\n' "ss is not installed." >&2; exit 1; }

temporary_directory=$(mktemp -d)
trap 'rm -rf "$temporary_directory"' EXIT
current_rules="$temporary_directory/current-rules"
allowed_rules="$temporary_directory/allowed-rules"
ufw show added 2>/dev/null | sed -n '/^ufw /p' | LC_ALL=C sort > "$current_rules"
expected_rules | LC_ALL=C sort > "$allowed_rules"
if [ -s "$current_rules" ]; then
  if [ -n "$(uniq -d "$current_rules")" ] ||
    [ -n "$(comm -23 "$current_rules" "$allowed_rules")" ]; then
    printf '%s\n' "Refusing to apply: unexpected or duplicate existing UFW allow rules were found." >&2
    printf '%s\n' "Review 'ufw show added' and remove obsolete rules manually before retrying." >&2
    exit 1
  fi
fi

if ! ss -lntH | awk '{print $4}' | grep -Eq "(^|[:.])${ssh_port}$"; then
  printf 'Refusing to enable UFW: no TCP listener found on SSH port %s.\n' "$ssh_port" >&2
  exit 1
fi

ufw default deny incoming
ufw default allow outgoing
if [ -n "$ssh_source" ]; then
  ufw limit from "$ssh_source" to any port "$ssh_port" proto tcp
else
  ufw limit "${ssh_port}/tcp"
fi
if [ "$role" = "proxy" ]; then
  ufw allow 80/tcp
  ufw allow 443/tcp
else
  ufw allow from "$proxy_source" to any port "$app_port" proto tcp
fi
ufw --force enable
ufw status verbose

if [ "$role" = "app" ]; then
  system_root=${FLOW_TASK_SYSTEM_ROOT:-}
  configuration_directory="${system_root}/etc/flow-task"
  executable_path="${system_root}/usr/local/sbin/flow-task-docker-firewall"
  unit_path="${system_root}/etc/systemd/system/flow-task-docker-firewall.service"
  mkdir -p "$configuration_directory" "$(dirname "$executable_path")" "$(dirname "$unit_path")"
  umask 077
  {
    printf 'PROXY_SOURCE=%s\n' "$proxy_source"
    printf 'APP_BIND_ADDRESS=%s\n' "$app_bind_address"
    printf 'APP_PORT=%s\n' "$app_port"
  } > "$configuration_directory/firewall.conf"
  install -m 0755 "$(dirname "$0")/configure-docker-user-firewall.sh" "$executable_path"
  install -m 0644 "$(dirname "$0")/flow-task-docker-firewall.service" "$unit_path"
  systemctl daemon-reload
  systemctl enable --now flow-task-docker-firewall.service
  systemctl is-active --quiet flow-task-docker-firewall.service
fi
