FROM postgres:17-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends rclone ca-certificates tzdata \
    && rm -rf /var/lib/apt/lists/*
COPY --chmod=755 deploy/backup/backup.sh /usr/local/bin/backup
COPY --chmod=755 deploy/backup/schedule.sh /usr/local/bin/backup-schedule
ENTRYPOINT ["/usr/local/bin/backup-schedule"]
