#!/usr/bin/env bash
# Runs on the self-hosted Coolify HOST, never inside a container.
set -euo pipefail

CONFIG=/etc/mekteb-disk-guard.conf
STATE_DIR=/var/lib/mekteb-disk-guard
LOCK=/run/mekteb-disk-guard.lock
THRESHOLD=${DISK_GUARD_THRESHOLD:-80}
ALERT_INTERVAL=86400
[[ "$THRESHOLD" =~ ^[0-9]+$ ]] && (( THRESHOLD >= 1 && THRESHOLD <= 100 )) || {
  echo "Invalid disk threshold" >&2
  exit 2
}

if [[ ! -f "$CONFIG" ]]; then
  echo "Missing $CONFIG" >&2
  exit 1
fi
# Root-owned configuration contains only the notification address and Coolify label.
# shellcheck source=/dev/null
source "$CONFIG"
: "${ALERT_EMAIL:?Set ALERT_EMAIL in $CONFIG}"
: "${APP_LABEL:?Set APP_LABEL in $CONFIG}"

mkdir -p "$STATE_DIR"
exec 9>"$LOCK"
flock -n 9 || exit 0

log() { logger -t mekteb-disk-guard -- "$*"; printf '%s\n' "$*"; }

send_mail() {
  local subject=$1 body=$2 container
  container=$(docker ps -q --filter "label=$APP_LABEL" | head -n 1)
  if [[ -z "$container" ]]; then
    log "Cannot send disk warning: Mekteb application container is not running"
    return 1
  fi
  # SMTP credentials remain in the existing application container environment;
  # they are never printed, copied to the host, or passed on a command line.
  timeout 40 docker exec -i "$container" node - "$ALERT_EMAIL" "$subject" "$body" <<'NODE'
const nodemailer = require("/app/artifacts/api-server/node_modules/nodemailer");
const [to, subject, text] = process.argv.slice(2);
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL } = process.env;
if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
  console.error("SMTP configuration missing in application container");
  process.exit(1);
}
const port = Number(SMTP_PORT || 587);
const transport = nodemailer.createTransport({
  host: SMTP_HOST, port, secure: port === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
  connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
});
transport.sendMail({ from: FROM_EMAIL || "info@mekteb.net", to, subject, text })
  .then(() => console.log("Warning email accepted by SMTP server"))
  .catch(err => {
    console.error("Warning email failed:", err.code || "SMTP error");
    process.exitCode = 1;
  });
NODE
}

check_disk() {
  local percent now last=0
  percent=$(df -P / | awk 'NR==2 {gsub(/%/, "", $5); print $5}')
  [[ "$percent" =~ ^[0-9]+$ ]] || { log "Cannot read root filesystem usage"; return 1; }
  if (( percent < THRESHOLD )); then
    rm -f "$STATE_DIR/last-alert"
    return 0
  fi
  now=$(date +%s)
  if [[ -f "$STATE_DIR/last-alert" ]]; then
    read -r last < "$STATE_DIR/last-alert" || last=0
  fi
  [[ "$last" =~ ^[0-9]+$ ]] || last=0
  if (( now - last < ALERT_INTERVAL )); then return 0; fi
  local message="Disk on $(hostname) is ${percent}% full (threshold ${THRESHOLD}%). Check df -h / and docker system df on the Hetzner host. Only unused build cache may be pruned; do not delete volumes, databases, or running images."
  if send_mail "[Mekteb] Disk warning: ${percent}% full" "$message"; then
    printf '%s\n' "$now" > "$STATE_DIR/last-alert"
    log "Disk warning delivered at ${percent}%"
  else
    log "Disk warning FAILED at ${percent}% (will retry on next check)"
    return 1
  fi
}

case "${1:-}" in
  check) check_disk ;;
  prune)
    log "Before build-cache prune: $(docker system df --format '{{json .}}' | grep 'Build Cache' || true)"
    # No image/container/volume/system prune. Keep recent (<7 days) cache.
    # Host BuildKit v0.14 does not support --max-used-space (despite CLI help).
    docker builder prune --force --filter 'until=168h'
    log "After build-cache prune: $(docker system df --format '{{json .}}' | grep 'Build Cache' || true)"
    check_disk
    ;;
  test-mail)
    send_mail "[Mekteb] Probno upozorenje o disku" \
      "Ovo je probna poruka sa Hetzner servera $(hostname). Upozorenje se šalje pri ${THRESHOLD}% zauzeća diska."
    ;;
  *)
    echo "Usage: $0 {check|prune|test-mail}" >&2
    exit 2
    ;;
esac