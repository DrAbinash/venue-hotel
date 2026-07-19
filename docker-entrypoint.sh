#!/bin/sh
set -e

echo "==> Applying database schema (prisma db push)..."
node ./node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss 2>/dev/null || {
  echo "WARNING: prisma db push failed. Trying with npx..."
  npx prisma db push --skip-generate --accept-data-loss 2>/dev/null || {
    echo "WARNING: prisma db push failed. Starting server anyway."
  }
}

echo "==> Seeding database on first run..."
node /app/docker-seed.js

echo "==> Starting The Venue server on port ${PORT:-3000}..."
exec node server.js