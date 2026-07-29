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

restricted_proxy_plan=$(sh "$script" --role proxy --ssh-source 10.0.0.0/24)
printf '%s\n' "$restricted_proxy_plan" | grep -q '^ufw limit from 10.0.0.0/24 to any port 22 proto tcp$' || fail "SSH source restriction missing"
printf '%s\n' "$restricted_proxy_plan" | grep -q '^ufw limit 22/tcp$' && fail "global SSH rule remained"

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
if sh "$script" --role proxy --ssh-source 10.0.0.0/99 >/dev/null 2>&1; then
  fail "invalid SSH source accepted"
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
  STUB_DOCKER_JUMP_STATE="$temporary_directory/docker-jump" \
  FLOW_TASK_FIREWALL_CONFIG="$configuration" sh "$script_dir/configure-docker-user-firewall.sh"
grep -q -- '--ctorigdst 10.0.0.225 --ctorigdstport 3000 -j ACCEPT' "$command_log" || fail "Docker proxy allow rule missing"
grep -q -- '--ctorigdst 10.0.0.225 --ctorigdstport 3000 -j DROP' "$command_log" || fail "Docker fallback drop rule missing"

# Docker may rebuild DOCKER-USER on restart. Model that loss, rerun the unit's
# command, and verify the jump is installed again rather than merely checking
# that the unit file contains a dependency string.
rm -f "$temporary_directory/docker-jump"
STUB_COMMAND_LOG="$command_log" PATH="$stub_directory:$PATH" \
  STUB_DOCKER_JUMP_STATE="$temporary_directory/docker-jump" \
  FLOW_TASK_FIREWALL_CONFIG="$configuration" sh "$script_dir/configure-docker-user-firewall.sh"
[ "$(grep -c 'iptables -w -I DOCKER-USER 1 -j FLOW_TASK_INGRESS' "$command_log")" -eq 2 ] ||
  fail "Docker restart simulation did not restore the chain jump"

command -v systemd-analyze >/dev/null 2>&1 || fail "systemd-analyze is required"
systemd_root="$temporary_directory/systemd-root"
mkdir -p "$systemd_root/etc/systemd/system" "$systemd_root/usr/local/sbin"
install -m 0644 "$script_dir/flow-task-docker-firewall.service" \
  "$systemd_root/etc/systemd/system/flow-task-docker-firewall.service"
install -m 0755 "$script_dir/configure-docker-user-firewall.sh" \
  "$systemd_root/usr/local/sbin/flow-task-docker-firewall"
printf '%s\n' \
  '[Unit]' \
  'Description=Test Docker daemon' \
  '[Service]' \
  'Type=oneshot' \
  'ExecStart=/usr/local/sbin/flow-task-docker-firewall' \
  'RemainAfterExit=yes' > "$systemd_root/etc/systemd/system/docker.service"
printf '%s\n' '[Unit]' 'Description=Test system initialization' > \
  "$systemd_root/etc/systemd/system/sysinit.target"
systemd-analyze verify --root="$systemd_root" flow-task-docker-firewall.service >/dev/null 2>&1 ||
  fail "systemd unit verification failed"

printf '%s\n' "Host firewall script tests passed."
