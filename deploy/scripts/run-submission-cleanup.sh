#!/bin/sh
set -eu

: "${CLEANUP_URL:?SUBMISSION_CLEANUP_URL is required}"
: "${CLEANUP_SECRET:?SUBMISSION_CLEANUP_SECRET is required}"

case "$CLEANUP_URL" in
  https://*) ;;
  *)
    echo "Cleanup URL must use HTTPS." >&2
    exit 1
    ;;
esac

CURL_BIN="${CURL_BIN:-curl}"
JQ_BIN="${JQ_BIN:-jq}"
response_file="$(mktemp)"
trap 'rm -f "$response_file"' EXIT

http_status="$($CURL_BIN \
  --proto '=https' \
  --max-redirs 0 \
  --silent \
  --show-error \
  --retry 3 \
  --retry-all-errors \
  --output "$response_file" \
  --write-out '%{http_code}' \
  --request POST \
  --header "Authorization: Bearer $CLEANUP_SECRET" \
  "$CLEANUP_URL")"

if [ "$http_status" != "200" ]; then
  echo "Cleanup API returned unexpected HTTP status: $http_status" >&2
  exit 1
fi

if ! "$JQ_BIN" -e '
  .success == true and
  (.data | type == "object") and
  (.data.scanned | type == "number") and
  (.data.cleaned | type == "number") and
  (.data.failed == 0) and
  (.data.batches | type == "number") and
  (.data.completedAt | type == "string")
' "$response_file" >/dev/null; then
  echo "Cleanup API returned an invalid or unsuccessful response." >&2
  exit 1
fi

echo "Submission upload cleanup completed successfully."
