#!/bin/sh
set -eu

project_root="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
runner="$project_root/deploy/scripts/run-submission-cleanup.sh"
temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT

cat > "$temp_dir/curl" <<'EOF'
#!/bin/sh
set -eu
output_file=""
previous=""
for argument in "$@"; do
  if [ "$previous" = "--output" ]; then
    output_file="$argument"
  fi
  printf '%s\n' "$argument" >> "$MOCK_ARGUMENTS_FILE"
  previous="$argument"
done
test -n "$output_file"
printf '%s' "$MOCK_BODY" > "$output_file"
printf '%s' "$MOCK_STATUS"
EOF
chmod +x "$temp_dir/curl"

expect_failure() {
  name="$1"
  url="$2"
  status="$3"
  body="$4"
  arguments_file="$temp_dir/$name.arguments"
  if CLEANUP_URL="$url" \
    CLEANUP_SECRET="test-cleanup-secret-value-at-least-32-characters" \
    CURL_BIN="$temp_dir/curl" \
    JQ_BIN="jq" \
    MOCK_STATUS="$status" \
    MOCK_BODY="$body" \
    MOCK_ARGUMENTS_FILE="$arguments_file" \
    sh "$runner" >/dev/null 2>&1; then
    echo "Expected failure: $name" >&2
    exit 1
  fi
}

expect_failure "http-url" "http://example.com/cleanup" "200" '{"success":true}'
test ! -e "$temp_dir/http-url.arguments"
expect_failure "redirect" "https://example.com/cleanup" "302" '<html>redirect</html>'
expect_failure "unauthorized" "https://example.com/cleanup" "401" '{"success":false}'
expect_failure "server-error" "https://example.com/cleanup" "500" '{"success":false}'
expect_failure "false-success" "https://example.com/cleanup" "200" '{"success":false,"data":{"failed":0}}'

success_arguments="$temp_dir/success.arguments"
CLEANUP_URL="https://example.com/cleanup" \
CLEANUP_SECRET="test-cleanup-secret-value-at-least-32-characters" \
CURL_BIN="$temp_dir/curl" \
JQ_BIN="jq" \
MOCK_STATUS="200" \
MOCK_BODY='{"success":true,"data":{"scanned":2,"cleaned":2,"failed":0,"batches":1,"completedAt":"2026-07-16T00:00:00.000Z"}}' \
MOCK_ARGUMENTS_FILE="$success_arguments" \
sh "$runner" >/dev/null

grep -Fx -- "--proto" "$success_arguments" >/dev/null
grep -Fx -- "=https" "$success_arguments" >/dev/null
grep -Fx -- "--max-redirs" "$success_arguments" >/dev/null
grep -Fx -- "0" "$success_arguments" >/dev/null
if grep -Fx -- "--location" "$success_arguments" >/dev/null; then
  echo "Cleanup request must not follow redirects." >&2
  exit 1
fi

echo "Submission cleanup workflow script tests passed."
