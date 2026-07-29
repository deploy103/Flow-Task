#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
script="$script_dir/harden-host-firewall.sh"
temporary_directory=$(mktemp -d)
trap 'rm -rf "$temporary_directory"' EXIT

fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }

proxy_plan=$(sh "$script" --role proxy --ssh-port 2222)
printf '%s\n' "$proxy_plan" | grep -q '^ufw limit 2222/tcp$' || fail "custom SSH port missing"
printf '%s\n' "$proxy_plan" | grep -q '^ufw allow 443/tcp$' || fail "proxy HTTPS rule missing"
printf '%s\n' "$proxy_plan" | grep -q 'port 3000' && fail "proxy plan exposed app port"

app_plan=$(sh "$script" --role app --proxy-source 10.0.0.12 --app-bind-address 10.0.0.225 --app-port 3000)
printf '%s\n' "$app_plan" | grep -q '^ufw allow from 10.0.0.12 to any port 3000 proto tcp$' || fail "app source restriction missing"
printf '%s\n' "$app_plan" | grep -q 'allow 80' && fail "app plan exposed HTTP"

if sh "$script" --role app --proxy-source 999.0.0.1 --app-bind-address 10.0.0.225 >/dev/null 2>&1; then
  fail "invalid IPv4 source accepted"
fi
if sh "$script" --role app --proxy-source 10.0.0.0/99 --app-bind-address 10.0.0.225 >/dev/null 2>&1; then
  fail "invalid CIDR prefix accepted"
fi
if sh "$script" --role proxy --ssh-port 0 >/dev/null 2>&1; then
  fail "invalid SSH port accepted"
fi

stub_directory="$temporary_directory/bin"
mkdir -p "$stub_directory"
for command_name in id ss ufw install systemctl iptables; do
  command_path="$stub_directory/$command_name"
  sed "s/__COMMAND__/$command_name/g" "$script_dir/test-host-firewall-command.stub" > "$command_path"
  chmod 755 "$command_path"
done

command_log="$temporary_directory/commands.log"
if STUB_UFW_RULE='ufw allow 5432/tcp' STUB_COMMAND_LOG="$command_log" \
  PATH="$stub_directory:$PATH" FLOW_TASK_SYSTEM_ROOT="$temporary_directory/root" \
  sh "$script" --role proxy --apply >/dev/null 2>&1; then
  fail "unexpected existing UFW rule was accepted"
fi
grep -q 'ufw default' "$command_log" && fail "firewall changed after unexpected rule"

: > "$command_log"
STUB_COMMAND_LOG="$command_log" PATH="$stub_directory:$PATH" \
  FLOW_TASK_SYSTEM_ROOT="$temporary_directory/root" \
  sh "$script" --role app --proxy-source 10.0.0.12 --app-bind-address 10.0.0.225 --apply >/dev/null
grep -q 'systemctl enable --now flow-task-docker-firewall.service' "$command_log" || fail "persistent Docker policy was not enabled"

configuration="$temporary_directory/docker-firewall.conf"
printf '%s\n' 'PROXY_SOURCE=10.0.0.12' 'APP_BIND_ADDRESS=10.0.0.225' 'APP_PORT=3000' > "$configuration"
: > "$command_log"
STUB_COMMAND_LOG="$command_log" PATH="$stub_directory:$PATH" \
  FLOW_TASK_FIREWALL_CONFIG="$configuration" sh "$script_dir/configure-docker-user-firewall.sh"
grep -q -- '--ctorigdst 10.0.0.225 --ctorigdstport 3000 -j ACCEPT' "$command_log" || fail "Docker proxy allow rule missing"
grep -q -- '--ctorigdst 10.0.0.225 --ctorigdstport 3000 -j DROP' "$command_log" || fail "Docker fallback drop rule missing"

printf '%s\n' "Host firewall script tests passed."
