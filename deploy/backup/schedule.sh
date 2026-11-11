#!/bin/sh
set -eu
export TZ=Europe/Moscow
if [ "${1:-}" = once ]; then exec /usr/local/bin/backup; fi
# Run immediately; after failure retry in an hour. Then run daily at 03:00 Moscow.
trap 'exit 0' INT TERM
while :; do
  if /usr/local/bin/backup; then
    now=$(date +%s)
    next=$(date -d 'today 03:00' +%s)
    if [ "$next" -le "$now" ]; then next=$(date -d 'tomorrow 03:00' +%s); fi
    delay=$((next - now))
  else
    echo 'BACKUP FAILED; retry in one hour' >&2
    delay=3600
  fi
  sleep "$delay" &
  wait $! || true
done
