#!/usr/bin/env bash
# Pull the latest code, build, migrate and restart. Run as the "abo" user
# from the repo root on the server:
#   bash deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

git pull --ff-only
npm ci
npm run build
npx prisma migrate deploy
pm2 startOrReload deploy/ecosystem.config.js
pm2 save

echo "==> Deployed $(git rev-parse --short HEAD)"
