#!/bin/bash
set -euo pipefail
cd /opt/zaloghub-alpha
exec 9>/run/lock/zaloghub-deploy.lock
flock -n 9 || { echo 'Deployment already running' >&2; exit 1; }
command=${SSH_ORIGINAL_COMMAND:-${1:-}}
if [[ ! "$command" =~ ^deploy\ ([a-f0-9]{40})$ ]]; then
  echo 'Only deploy <40-character commit SHA> is allowed' >&2; exit 1
fi
tag=${BASH_REMATCH[1]}
export IMAGE_TAG="$tag"
# The short-lived Actions token arrives on stdin, never in command arguments.
registry_token=''
IFS= read -r -t 10 registry_token || true
if test -n "$registry_token"; then
  export DOCKER_CONFIG
  DOCKER_CONFIG=$(mktemp -d /tmp/zaloghub-registry.XXXXXX)
  trap 'rm -rf -- "$DOCKER_CONFIG"' EXIT
  printf '%s\n' "$registry_token" | docker login ghcr.io -u DanikChub --password-stdin
  unset registry_token
fi
compose=(docker compose --env-file .env)
profiles=()
if test -s deploy/secrets/collector.env; then profiles+=(--profile collector); fi
if test -s deploy/secrets/rclone/rclone.conf; then profiles+=(--profile backup); fi
"${compose[@]}" "${profiles[@]}" pull
# Keep a local pre-deployment snapshot. No automatic destructive DB rollback.
if "${compose[@]}" exec -T db pg_isready -U zaloghub -d zaloghub_alpha >/dev/null 2>&1; then
  mkdir -p /opt/zaloghub-alpha/.local/predeploy
  umask 077
  dump=".local/predeploy/$(date -u +%Y%m%dT%H%M%SZ).dump"
  "${compose[@]}" exec -T db pg_dump -U zaloghub -d zaloghub_alpha -Fc > "$dump.partial"
  test -s "$dump.partial"
  mv "$dump.partial" "$dump"
fi
# Existing one-shot migration containers must be replaced for every release.
"${compose[@]}" rm -f migrate
"${compose[@]}" up -d db
"${compose[@]}" run --rm migrate
"${compose[@]}" "${profiles[@]}" up -d --wait --wait-timeout 240
curl --fail --silent http://127.0.0.1:8080/api/health/db >/dev/null
if test -f .release; then cp .release .previous-release; fi
printf '%s\n' "$tag" > .release
# Persist the successful release for manual compose invocations and reboots.
if grep -q '^IMAGE_TAG=' .env; then sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$tag/" .env; else printf '\nIMAGE_TAG=%s\n' "$tag" >> .env; fi
echo "Deployed $tag"
