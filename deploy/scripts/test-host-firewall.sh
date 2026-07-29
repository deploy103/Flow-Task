#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
script="$script_dir/harden-host-firewall.sh"
temporary_directory=$(mktemp -d)
trap 'rm -rf "$temporary_directory"' EXIT

fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }

proxy_plan=$($script --role proxy --ssh-port 2222)
printf '%s\n' "$proxy_plan" | grep -q '^ufw limit 2222/tcp$' || fail "custom SSH port missing"
printf '%s\n' "$proxy_plan" | grep -q '^ufw allow 443/tcp$' || fail "proxy HTTPS rule missing"
printf '%s\n' "$proxy_plan" | grep -q 'port 3000' && fail "proxy plan exposed app port"

app_plan=$($script --role app --proxy-source 10.0.0.12 --app-port 3000)
printf '%s\n' "$app_plan" | grep -q '^ufw allow from 10.0.0.12 to any port 3000 proto tcp$' || fail "app source restriction missing"
printf '%s\n' "$app_plan" | grep -q 'allow 80' && fail "app plan exposed HTTP"

if $script --role app --proxy-source 999.0.0.1 >/dev/null 2>&1; then
  fail "invalid IPv4 source accepted"
fi
if $script --role app --proxy-source 10.0.0.0/99 >/dev/null 2>&1; then
  fail "invalid CIDR prefix accepted"
fi
if $script --role proxy --ssh-port 0 >/dev/null 2>&1; then
  fail "invalid SSH port accepted"
fi

printf '%s\n' "Host firewall script tests passed."
