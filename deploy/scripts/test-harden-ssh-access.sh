#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
script="$script_dir/harden-ssh-access.sh"
temporary_directory=$(mktemp -d)
trap 'rm -rf "$temporary_directory"' EXIT

fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }

private_key="$temporary_directory/id_ed25519"
public_key="$private_key.pub"
ssh-keygen -q -t ed25519 -N '' -f "$private_key"
fingerprint=$(ssh-keygen -l -E sha256 -f "$public_key" | awk '{print $2}')
target_user=$(id -un)
target_group=$(id -gn)

prepare_plan=$(sh "$script" --phase prepare --user "$target_user" --public-key-file "$public_key")
printf '%s\n' "$prepare_plan" | grep -q "Validated public key fingerprint: $fingerprint" ||
  fail "prepare did not print the key fingerprint"
printf '%s\n' "$prepare_plan" | grep -q "^Would install the key for $target_user" ||
  fail "prepare plan missing"

if sh "$script" --phase enforce --user "$target_user" --public-key-file "$public_key" \
  --confirmed-fingerprint SHA256:not-the-key >/dev/null 2>&1; then
  fail "enforce accepted a mismatched fingerprint"
fi
if sh "$script" --phase prepare --user 'bad user' --public-key-file "$public_key" >/dev/null 2>&1; then
  fail "invalid user accepted"
fi
if sh "$script" --phase prepare --user root --public-key-file "$public_key" >/dev/null 2>&1; then
  fail "root accepted as the retained SSH user"
fi

stub_directory="$temporary_directory/bin"
user_home="$temporary_directory/home/$target_user"
system_root="$temporary_directory/root"
command_log="$temporary_directory/commands.log"
mkdir -p "$stub_directory" "$user_home" "$system_root/etc/ssh/sshd_config.d"

cat > "$stub_directory/id" <<'EOF'
#!/bin/sh
case "$1" in
  -u) printf '%s\n' 0 ;;
  -gn) printf '%s\n' "$STUB_TARGET_GROUP" ;;
  *) exit 1 ;;
esac
EOF
cat > "$stub_directory/getent" <<'EOF'
#!/bin/sh
printf '%s:x:1001:1001::%s:/bin/sh\n' "$STUB_TARGET_USER" "$STUB_USER_HOME"
EOF
cat > "$stub_directory/sshd" <<'EOF'
#!/bin/sh
case "$1" in
  -t) [ "${STUB_SSHD_VALID:-true}" = true ] ;;
  -T)
    printf '%s\n' \
      'port 22' \
      'permitrootlogin no' \
      'pubkeyauthentication yes' \
      "passwordauthentication ${STUB_PASSWORD_AUTHENTICATION:-no}" \
      'kbdinteractiveauthentication no' \
      "allowusers $STUB_TARGET_USER"
    ;;
  *) exit 1 ;;
esac
EOF
cat > "$stub_directory/systemctl" <<'EOF'
#!/bin/sh
printf 'systemctl %s\n' "$*" >> "$STUB_COMMAND_LOG"
[ "${STUB_RELOAD_SUCCESS:-true}" = true ]
EOF
chmod 755 "$stub_directory/id" "$stub_directory/getent" "$stub_directory/sshd" "$stub_directory/systemctl"

PATH="$stub_directory:$PATH" STUB_USER_HOME="$user_home" STUB_TARGET_USER="$target_user" \
  STUB_TARGET_GROUP="$target_group" STUB_COMMAND_LOG="$command_log" FLOW_TASK_SYSTEM_ROOT="$system_root" \
  sh "$script" --phase prepare --user "$target_user" \
  --public-key-file "$public_key" --apply >/dev/null
grep -Fqx "$(cat "$public_key")" "$user_home/.ssh/authorized_keys" || fail "key not installed"
[ "$(stat -c %a "$user_home/.ssh")" = 700 ] || fail "incorrect .ssh mode"
[ "$(stat -c %a "$user_home/.ssh/authorized_keys")" = 600 ] || fail "incorrect authorized_keys mode"

PATH="$stub_directory:$PATH" STUB_USER_HOME="$user_home" STUB_TARGET_USER="$target_user" \
  STUB_TARGET_GROUP="$target_group" STUB_COMMAND_LOG="$command_log" FLOW_TASK_SYSTEM_ROOT="$system_root" \
  sh "$script" --phase enforce --user "$target_user" \
  --public-key-file "$public_key" --confirmed-fingerprint "$fingerprint" --apply >/dev/null
drop_in="$system_root/etc/ssh/sshd_config.d/90-flow-task-hardening.conf"
grep -qx 'PasswordAuthentication no' "$drop_in" || fail "password authentication not disabled"
grep -qx "AllowUsers $target_user" "$drop_in" || fail "SSH user restriction missing"
grep -q '^systemctl reload ssh.service$' "$command_log" || fail "SSH was not reloaded"

printf '%s\n' 'PasswordAuthentication yes' > "$drop_in"
if PATH="$stub_directory:$PATH" STUB_USER_HOME="$user_home" STUB_TARGET_USER="$target_user" \
  STUB_TARGET_GROUP="$target_group" STUB_COMMAND_LOG="$command_log" FLOW_TASK_SYSTEM_ROOT="$system_root" \
  STUB_PASSWORD_AUTHENTICATION=yes sh "$script" --phase enforce \
  --user "$target_user" --public-key-file "$public_key" --confirmed-fingerprint "$fingerprint" \
  --apply >/dev/null 2>&1; then
  fail "ineffective SSH configuration was accepted"
fi
grep -qx 'PasswordAuthentication yes' "$drop_in" || fail "ineffective configuration was not rolled back"

printf '%s\n' 'PasswordAuthentication yes' > "$drop_in"
if PATH="$stub_directory:$PATH" STUB_USER_HOME="$user_home" STUB_TARGET_USER="$target_user" \
  STUB_TARGET_GROUP="$target_group" STUB_COMMAND_LOG="$command_log" FLOW_TASK_SYSTEM_ROOT="$system_root" \
  STUB_RELOAD_SUCCESS=false sh "$script" --phase enforce \
  --user "$target_user" --public-key-file "$public_key" --confirmed-fingerprint "$fingerprint" \
  --apply >/dev/null 2>&1; then
  fail "failed SSH reload was accepted"
fi
grep -qx 'PasswordAuthentication yes' "$drop_in" || fail "reload failure was not rolled back"

printf '%s\n' "SSH hardening script tests passed."
