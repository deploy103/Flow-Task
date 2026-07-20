#!/bin/sh
set -eu
: "${DELIVERY_URL:?NOTIFICATION_DELIVERY_URL is required}"
: "${DELIVERY_SECRET:?NOTIFICATION_DELIVERY_SECRET is required}"
case "$DELIVERY_URL" in https://*) ;; *) echo "Delivery URL must use HTTPS." >&2; exit 1 ;; esac
response_file="$(mktemp)"
trap 'rm -f "$response_file"' EXIT
status="$(curl --proto '=https' --max-redirs 0 --silent --show-error --retry 3 --retry-all-errors --output "$response_file" --write-out '%{http_code}' --request POST --header "Authorization: Bearer $DELIVERY_SECRET" "$DELIVERY_URL")"
test "$status" = "200"
jq -e '.success == true and (.data.selected | type == "number") and (.data.sent | type == "number") and (.data.failed == 0)' "$response_file" >/dev/null
echo "Notification delivery completed successfully."
