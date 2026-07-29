#!/bin/sh
set -eu

[ "$(id -u)" -eq 0 ] || { printf '%s\n' "Docker firewall configuration requires root." >&2; exit 1; }
configuration=${FLOW_TASK_FIREWALL_CONFIG:-/etc/flow-task/firewall.conf}
[ -r "$configuration" ] || { printf '%s\n' "Firewall configuration is missing." >&2; exit 1; }

# The file is root-owned and generated only after strict IPv4/port validation.
# shellcheck disable=SC1090
. "$configuration"
: "${PROXY_SOURCE:?PROXY_SOURCE is required}"
: "${APP_BIND_ADDRESS:?APP_BIND_ADDRESS is required}"
: "${APP_PORT:?APP_PORT is required}"

command -v iptables >/dev/null 2>&1 || { printf '%s\n' "iptables is not installed." >&2; exit 1; }
chain="FLOW_TASK_INGRESS"

iptables -w -N "$chain" 2>/dev/null || true
iptables -w -F "$chain"
iptables -w -A "$chain" -s "$PROXY_SOURCE" -p tcp \
  -m conntrack --ctdir ORIGINAL --ctorigdst "$APP_BIND_ADDRESS" --ctorigdstport "$APP_PORT" \
  -j ACCEPT
iptables -w -A "$chain" -p tcp \
  -m conntrack --ctdir ORIGINAL --ctorigdst "$APP_BIND_ADDRESS" --ctorigdstport "$APP_PORT" \
  -j DROP
iptables -w -A "$chain" -j RETURN

iptables -w -C DOCKER-USER -j "$chain" 2>/dev/null ||
  iptables -w -I DOCKER-USER 1 -j "$chain"

iptables -w -C "$chain" -s "$PROXY_SOURCE" -p tcp \
  -m conntrack --ctdir ORIGINAL --ctorigdst "$APP_BIND_ADDRESS" --ctorigdstport "$APP_PORT" \
  -j ACCEPT
iptables -w -C "$chain" -p tcp \
  -m conntrack --ctdir ORIGINAL --ctorigdst "$APP_BIND_ADDRESS" --ctorigdstport "$APP_PORT" \
  -j DROP
