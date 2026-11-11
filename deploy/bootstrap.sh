#!/bin/bash
set -euo pipefail
test "$(id -u)" -eq 0
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y docker.io docker-compose-v2 curl ca-certificates rclone
systemctl enable --now docker
if ! swapon --show --noheadings | grep -q .; then
  if test -e /swapfile-zaloghub; then echo 'Existing swap file needs manual review' >&2; exit 1; fi
  fallocate -l 1G /swapfile-zaloghub
  chmod 600 /swapfile-zaloghub
  mkswap /swapfile-zaloghub
  swapon /swapfile-zaloghub
  printf '/swapfile-zaloghub none swap sw 0 0\n' >> /etc/fstab
fi
install -d -m 700 /opt/zaloghub-alpha/deploy/secrets/rclone
docker version --format '{{.Server.Version}}'
docker compose version
