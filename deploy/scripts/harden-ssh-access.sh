#!/bin/sh
set -eu

usage() {
  cat <<'EOF'
Usage:
  harden-ssh-access.sh --phase prepare --user USER --public-key-file FILE [--apply]
  harden-ssh-access.sh --phase enforce --user USER --public-key-file FILE
                       --confirmed-fingerprint SHA256:... [--apply]

Run prepare first, then prove a new SSH session works with the matching private
key. Only then run enforce with the fingerprint printed by prepare.
Without --apply the script validates inputs and prints the intended changes.
EOF
}

phase=""
target_user=""
public_key_file=""
confirmed_fingerprint=""
apply="false"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --phase) [ "$#" -ge 2 ] || { usage >&2; exit 2; }; phase=$2; shift 2 ;;
    --user) [ "$#" -ge 2 ] || { usage >&2; exit 2; }; target_user=$2; shift 2 ;;
    --public-key-file) [ "$#" -ge 2 ] || { usage >&2; exit 2; }; public_key_file=$2; shift 2 ;;
    --confirmed-fingerprint) [ "$#" -ge 2 ] || { usage >&2; exit 2; }; confirmed_fingerprint=$2; shift 2 ;;
    --apply) apply="true"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'Unknown argument: %s\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
done

[ "$phase" = "prepare" ] || [ "$phase" = "enforce" ] || { printf '%s\n' "Invalid --phase." >&2; exit 2; }
printf '%s\n' "$target_user" | grep -Eq '^[a-z_][a-z0-9_-]{0,31}$' || { printf '%s\n' "Invalid user." >&2; exit 2; }
[ "$target_user" != "root" ] || { printf '%s\n' "Root cannot be the retained SSH user." >&2; exit 2; }
[ -r "$public_key_file" ] || { printf '%s\n' "Public key file is not readable." >&2; exit 2; }
[ "$(wc -l < "$public_key_file")" -eq 1 ] || { printf '%s\n' "Public key must contain exactly one line." >&2; exit 2; }
grep -Eq '^ssh-ed25519 [A-Za-z0-9+/]+={0,3}([[:space:]].*)?$' "$public_key_file" || {
  printf '%s\n' "Only a single Ed25519 public key is accepted." >&2
  exit 2
}
command -v ssh-keygen >/dev/null 2>&1 || { printf '%s\n' "ssh-keygen is required." >&2; exit 1; }
fingerprint=$(ssh-keygen -l -E sha256 -f "$public_key_file" | awk '{print $2}')
printf 'Validated public key fingerprint: %s\n' "$fingerprint"

if [ "$phase" = "enforce" ] && [ "$confirmed_fingerprint" != "$fingerprint" ]; then
  printf '%s\n' "The confirmed fingerprint does not match the public key." >&2
  exit 2
fi

if [ "$apply" != "true" ]; then
  if [ "$phase" = "prepare" ]; then
    printf 'Would install the key for %s without disabling password authentication.\n' "$target_user"
  else
    printf 'Would disable root/password/keyboard-interactive SSH and allow only %s.\n' "$target_user"
  fi
  exit 0
fi

[ "$(id -u)" -eq 0 ] || { printf '%s\n' "Run --apply as root." >&2; exit 1; }
user_home=$(getent passwd "$target_user" | awk -F: 'NR == 1 {print $6}')
[ -n "$user_home" ] && [ -d "$user_home" ] || { printf '%s\n' "Target user does not exist." >&2; exit 1; }
target_group=$(id -gn "$target_user")
ssh_directory="$user_home/.ssh"
authorized_keys="$ssh_directory/authorized_keys"

if [ "$phase" = "prepare" ]; then
  install -d -m 0700 -o "$target_user" -g "$target_group" "$ssh_directory"
  temporary_keys=$(mktemp)
  trap 'rm -f "$temporary_keys"' EXIT
  if [ -f "$authorized_keys" ]; then
    awk 'NF' "$authorized_keys" > "$temporary_keys"
  fi
  key_value=$(cat "$public_key_file")
  grep -Fqx "$key_value" "$temporary_keys" || printf '%s\n' "$key_value" >> "$temporary_keys"
  install -m 0600 -o "$target_user" -g "$target_group" "$temporary_keys" "$authorized_keys"
  printf 'Key installed. Open a new key-authenticated session and verify fingerprint %s before enforce.\n' "$fingerprint"
  exit 0
fi

grep -Fqx "$(cat "$public_key_file")" "$authorized_keys" 2>/dev/null || {
  printf '%s\n' "The confirmed key is not installed in authorized_keys." >&2
  exit 1
}
command -v sshd >/dev/null 2>&1 || [ -x /usr/sbin/sshd ] || { printf '%s\n' "sshd is required." >&2; exit 1; }
sshd_binary=$(command -v sshd 2>/dev/null || printf '%s\n' /usr/sbin/sshd)
system_root=${FLOW_TASK_SYSTEM_ROOT:-}
drop_in_directory="${system_root}/etc/ssh/sshd_config.d"
drop_in="$drop_in_directory/90-flow-task-hardening.conf"
mkdir -p "$drop_in_directory"
backup=""
if [ -f "$drop_in" ]; then
  backup="$drop_in.backup.$(date +%s)"
  cp -p "$drop_in" "$backup"
fi
rollback() {
  if [ -n "$backup" ]; then cp -p "$backup" "$drop_in"; else rm -f "$drop_in"; fi
}
trap 'rollback' HUP INT TERM
umask 077
{
  printf '%s\n' \
    'PermitRootLogin no' \
    'PubkeyAuthentication yes' \
    'PasswordAuthentication no' \
    'KbdInteractiveAuthentication no' \
    'MaxAuthTries 3' \
    'LoginGraceTime 30' \
    "AllowUsers $target_user"
} > "$drop_in"
if ! "$sshd_binary" -t; then
  rollback
  printf '%s\n' "sshd validation failed; previous configuration restored." >&2
  exit 1
fi
effective_after=$("$sshd_binary" -T 2>/dev/null || true)
if ! printf '%s\n' "$effective_after" | grep -qx 'permitrootlogin no' ||
  ! printf '%s\n' "$effective_after" | grep -qx 'pubkeyauthentication yes' ||
  ! printf '%s\n' "$effective_after" | grep -qx 'passwordauthentication no' ||
  ! printf '%s\n' "$effective_after" | grep -qx 'kbdinteractiveauthentication no' ||
  ! printf '%s\n' "$effective_after" | grep -qx "allowusers $target_user"; then
  rollback
  printf '%s\n' "The SSH drop-in is not effective; previous configuration restored." >&2
  exit 1
fi
if ! systemctl reload ssh.service; then
  rollback
  printf '%s\n' "SSH reload failed; previous configuration restored." >&2
  exit 1
fi
trap - HUP INT TERM
printf '%s\n' "SSH hardening applied. Keep this session open until a second key-authenticated login succeeds."
