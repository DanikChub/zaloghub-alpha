#!/bin/sh
set -eu
umask 077
: "${RCLONE_DEST:?Configure encrypted rclone destination}"
mkdir -p /backups
stamp=$(date -u +%Y%m%dT%H%M%SZ)
file="/backups/zaloghub-${stamp}.dump"
verify="backup_verify_$(date -u +%Y%m%d%H%M%S)_$$"
cleanup() {
  dropdb --if-exists "$verify" >/dev/null 2>&1 || true
  rm -f "$file.partial"
}
trap cleanup EXIT
trap 'exit 1' INT TERM
echo "Creating PostgreSQL backup $stamp"
pg_dump --format=custom --no-owner --no-acl --file="$file.partial"
# A real restore catches failures that an archive listing cannot detect.
createdb --template=template0 "$verify"
pg_restore --exit-on-error --no-owner --no-acl --dbname="$verify" "$file.partial"
psql --dbname="$verify" -v ON_ERROR_STOP=1 -c 'SELECT count(*) FROM marketplace_offers; SELECT count(*) FROM marketplace_photos;' >/dev/null
dropdb "$verify"
mv "$file.partial" "$file"
sha256sum "$file" > "$file.sha256"
rclone copyto "$file" "${RCLONE_DEST%/}/$(basename "$file")" --retries 5 --low-level-retries 10
rclone copyto "$file.sha256" "${RCLONE_DEST%/}/$(basename "$file").sha256" --retries 5
# Download through the crypt remote, decrypt and verify actual remote bytes.
remote_hash=$(rclone cat "${RCLONE_DEST%/}/$(basename "$file")" | sha256sum | cut -d ' ' -f 1)
local_hash=$(sha256sum "$file" | cut -d ' ' -f 1)
test "$remote_hash" = "$local_hash"
touch /backups/last-success
find /backups -type f -name 'zaloghub-*.dump*' -mtime +7 -delete
echo "Backup restored, uploaded and verified: $stamp"
