# Production deployment

The existing Nginx/Certbot installation terminates HTTPS for app.zaloghub.ru.
Compose exposes only 127.0.0.1:8080; neither PostgreSQL nor API has a host port.
The original landing page can remain on zaloghub.ru. Build images in GitHub
Actions, not on the 1 GB VPS. bootstrap.sh installs Docker and 1 GB swap.

## Configuration

Copy deploy/.env.example to .env. Choose a random hexadecimal database password.
Create deploy/secrets/api.env from deploy/api.env.example and collector.env from
apps/collector/.env.example. Use the same collector token in API and collector.
The database password in DATABASE_URL must match POSTGRES_PASSWORD in .env.
Use independent random JWT_SECRET and AUTH_CODE_SECRET. Restrict secrets to
the server administrator; never commit or upload them as Actions artifacts.

The production API requires SMTP. REG.RU mail uses mail.hosting.reg.ru:465,
full mailbox name as username and the mailbox password. SPF/DKIM/MX records
must match the mail provider's panel. Do not change the website A records.

## Releases and CI

pipeline.yml checks unit tests, real PostgreSQL integration tests, builds,
and Compose syntax. It builds API, web, collector and backup images tagged by
the exact commit SHA. Pull-request builds do not publish images.

Install compose.yaml and deploy/ under /opt/zaloghub-alpha. These infrastructure
files are installed explicitly; image deployments do not overwrite server-side
Compose/scripts or secrets. Copy updated infrastructure before deploying a commit
that changes it. Application images are replaced automatically.

Configure the GitHub production environment:

- Secrets DEPLOY_SSH_KEY (a separate CI-only private key), DEPLOY_KNOWN_HOSTS
  (verified server host key, never use StrictHostKeyChecking=no).
- Variables DEPLOY_HOST and DEPLOY_USER (root for the initial VPS setup).
- Repository variable DEPLOY_ENABLED=true enables automatic deployments from main.

Install the CI public key with authorized_keys options:
`restrict,command="/opt/zaloghub-alpha/deploy/deploy.sh"`.
The only accepted command is deploy followed by a 40-character commit SHA.
The workstation administrator key remains separate. The workflow supplies a
short-lived read-packages token on stdin for private GHCR pulls. It is deleted
after use. Docker-group and root access are equivalent privileges on this VPS.

deploy.sh serializes deployments, takes a pre-migration dump, runs migrations,
waits for container health and checks API access through the web proxy. It records
.release and .previous-release. On failure it exits nonzero; there is no destructive
automatic database rollback. To revert code, deploy the previous SHA after checking
schema compatibility. Pre-deployment dumps remain in .local/predeploy; review disk
usage and archive them rather than indiscriminately pruning Docker volumes.

## Initial data

The local zaloghub_alpha database already contains the imported marketplace and
media. Take a pg_dump -Fc backup and restore it once into the empty Compose DB
before opening the application to users. Do not re-run a full restore over live
user data. Database volumes survive container replacement; never use down -v.

## Telegram

Start with --profile collector. It runs one GramJS session and one persistent
outbox in collector_data. Do not run two live collectors using the same session.
For a revoked session, run `node apps/collector/src/authorize.mjs` in your own
interactive terminal on the workstation. Phone, login code and 2FA password are
hidden; only TG_SESSION in deploy/secrets/collector.env is updated. Transfer that
file over SSH and recreate the collector. Never paste the session into chat or CI.
If no login code arrives, use `node apps/collector/src/authorize.mjs --qr`.
It opens a local auto-refreshing QR page. Scan through Telegram Settings →
Devices → Link Desktop Device; enter the 2FA password in the terminal if needed.
The page's temporary login token is removed after authorization ends.
Compose explicitly permits plain HTTP only to api:3000 on the internal network;
remote addresses still require HTTPS. Source metadata is polled every 30 seconds.
New messages and edits are collected while connected. Historical gap catch-up is
not automatic; after a prolonged outage use the bounded manual history command
documented in docs/marketplace.md, never an unbounded history import.

Check `docker compose logs --tail 100 collector` after restart and confirm a real
new publication arrives. A running process alone does not prove collection works.
The collector health check requires a recent successful source synchronization,
an active Telegram connection and at least one subscribed source. Startup loads
dialog access hashes, resolves channels by their stable ID and rejects a username
that points to a different channel. A failed startup exits so Docker can retry.

## Encrypted Google Drive backups

Create rclone remote gdrive (Drive OAuth) and crypt remote gdrive-crypt over
gdrive:ZalogHubBackups. Store rclone.conf in deploy/secrets/rclone/. The directory
is writable so OAuth token refresh can be saved. Back up the config and crypt
password outside this VPS; losing the crypt password makes backups unrecoverable.
RCLONE_DEST=gdrive-crypt:production goes in deploy/secrets/backup.env.

Start --profile backup only after authorization. On startup and daily at 03:00
Europe/Moscow it creates a consistent custom-format dump including media bytes,
restores into a uniquely named temporary database, uploads via rclone, downloads
and checks its SHA-256. The temporary database is removed even on failure.
Failures retry hourly and appear in logs. last-success older than 26 hours marks
the container unhealthy. Docker does not notify an administrator or restart a
container merely because it is unhealthy; external alerting must be configured
separately. Keep seven days of successful local dumps. Remote backups are not
automatically deleted; monitor Drive quota. Failed uploads keep the local dump.

Manual run: `docker compose --profile backup run --rm backup once`.

To restore, download the chosen dump through the crypt remote, compare SHA-256,
create a separate empty database and run `pg_restore --exit-on-error --no-owner
--no-acl --dbname=... backup.dump`. Check offer/photo counts and login before
switching DATABASE_URL. A daily dump permits up to 24 hours of data loss.

For later S3 backups, configure an S3 remote below crypt and change RCLONE_DEST.
Moving application photos to S3 is a separate storage migration; the current
API stores and serves media from PostgreSQL.
