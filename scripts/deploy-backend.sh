#!/usr/bin/env sh
set -eu

APP_DIR="${APP_DIR:-/opt/chatty}"
BRANCH="${BRANCH:-main}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-chatty}"
BACKEND_SERVICE="${BACKEND_SERVICE:-chatty-backend}"
FRONTEND_SERVICE="${FRONTEND_SERVICE:-chatty-frontend}"
COMPOSE="docker compose -p $COMPOSE_PROJECT_NAME -f $COMPOSE_FILE"

cd "$APP_DIR"

git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

$COMPOSE build "$BACKEND_SERVICE" "$FRONTEND_SERVICE"
$COMPOSE run --rm "$BACKEND_SERVICE" npm run prisma:deploy
$COMPOSE up -d --force-recreate "$BACKEND_SERVICE" "$FRONTEND_SERVICE"
docker image prune -f
