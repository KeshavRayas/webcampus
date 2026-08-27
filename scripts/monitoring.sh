#!/bin/bash
# Monitoring stack control. Two entry points:
#
#   bun monitoring          # LOCAL dev: monitoring + db/redis deps; scrapes
#                           # your host-run API (bun run dev) via file-SD target
#   bun monitoring:prod     # DEPLOYED: ENTIRE prod stack + monitoring, exactly
#                           # one scrape of the containerized API
#
#   bun monitoring status   # container state + Prometheus scrape health
#   bun monitoring down     # stop monitoring services
set -e

COMPOSE="docker compose -f compose.prod.yaml -f compose.monitoring.yaml"
MONITORING_SERVICES="grafana prometheus postgres-exporter redis-exporter"
TARGET_DIR="monitoring/prometheus/targets"
TARGET_FILE="$TARGET_DIR/api-dev.json"

PROM_URL="http://127.0.0.1:9090"
GRAFANA_URL="http://127.0.0.1:3001"

ensure_grafana_password() {
  if ! grep -q "^GRAFANA_ADMIN_PASSWORD=.\+" .env 2>/dev/null; then
    echo "Generating GRAFANA_ADMIN_PASSWORD into .env ..."
    printf '\n# ── Monitoring (Grafana, compose.monitoring.yaml) ────────────────────────────\nGRAFANA_ADMIN_USER=admin\nGRAFANA_ADMIN_PASSWORD=%s\n' \
      "$(openssl rand -base64 18)" >>.env
  fi
}

# Local machines scrape the host-run dev API through a gitignored file-SD
# target. Servers never have this file, so prod scrapes each process once.
ensure_local_target() {
  mkdir -p "$TARGET_DIR"
  if [ ! -f "$TARGET_FILE" ]; then
    printf '[{ "targets": ["host.docker.internal:8080"] }]\n' >"$TARGET_FILE"
    echo "Created $TARGET_FILE (scrapes your host-run dev API)"
  fi
}

remove_local_target() {
  if [ -f "$TARGET_FILE" ]; then
    rm -f "$TARGET_FILE"
    echo "Removed $TARGET_FILE (prod must not double-scrape the API)"
  fi
}

wait_for() {
  local name="$1" url="$2" tries=30
  printf "Waiting for %s ..." "$name"
  until curl -fsS "$url" >/dev/null 2>&1; do
    tries=$((tries - 1))
    if [ "$tries" -le 0 ]; then
      echo " TIMED OUT (check: $COMPOSE logs $name)"
      exit 1
    fi
    sleep 2
    printf "."
  done
  echo " ready"
}

scrape_health() {
  # Prometheus targets API: pair each target's scrape URL with its health.
  local json
  json="$(curl -fsS "$PROM_URL/api/v1/targets" 2>/dev/null || true)"
  if [ -z "$json" ]; then
    echo "Could not reach Prometheus at $PROM_URL"
    return 1
  fi
  echo "$json" | grep -oE '"scrapeUrl":"[^"]+"|"health":"[^"]+"' |
    sed 's/"scrapeUrl":/target:/; s/"health":/health:/' | paste - - |
    sed 's/"//g'
}

start_stack() {
  docker info >/dev/null 2>&1 || {
    echo "Docker is not running. Start Docker first."
    exit 1
  }
  ensure_grafana_password

  case "${1:-local}" in
    full)
      remove_local_target
      echo "Starting FULL prod + monitoring stack..."
      $COMPOSE up -d
      ;;
    *)
      ensure_local_target
      echo "Starting LOCAL monitoring stack (db/redis come up as dependencies)..."
      # shellcheck disable=SC2086
      $COMPOSE up -d $MONITORING_SERVICES
      ;;
  esac

  wait_for prometheus "$PROM_URL/-/ready"
  wait_for grafana "$GRAFANA_URL/api/health"

  echo ""
  echo "Scrape health:"
  scrape_health
  show_urls
}

stop_stack() {
  echo "Stopping monitoring services..."
  # shellcheck disable=SC2086
  $COMPOSE stop $MONITORING_SERVICES
}

show_status() {
  # shellcheck disable=SC2086
  $COMPOSE ps $MONITORING_SERVICES
  echo ""
  scrape_health || true
}

show_urls() {
  local user
  user="$(grep '^GRAFANA_ADMIN_USER=' .env | cut -d= -f2 || true)"
  cat <<EOF

Grafana     : $GRAFANA_URL  (login: ${user:-admin} / \${GRAFANA_ADMIN_PASSWORD} in .env)
Prometheus  : $PROM_URL     (targets: $PROM_URL/targets)

On a deployed server, view from your laptop:
  ssh -L 3001:localhost:3001 -L 9090:localhost:9090 <user>@<server>
EOF
}

case "${1:-local}" in
  local | start) start_stack local ;;
  full | prod) start_stack full ;;
  down) stop_stack ;;
  status) show_status ;;
  *)
    echo "Usage: bun monitoring [local|full|down|status]"
    exit 1
    ;;
esac
