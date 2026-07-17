#!/bin/sh
set -e
echo "==> Applying database schema (prisma db push)..."
node ./node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss || {
  echo "WARNING: prisma db push failed. Starting server anyway."
}
echo "==> Starting Next.js server on port ${PORT:-3000}..."
exec node server.js
