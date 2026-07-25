#!/bin/sh
set -e

echo "========================================="
echo "  The Venue - Docker Entrypoint"
echo "  Date: $(date)"
echo "  NODE_ENV: ${NODE_ENV}"
echo "  DATABASE_URL: ${DATABASE_URL}"
echo "  PORT: ${PORT:-3000}"
echo "========================================="

# Ensure data directory exists and is writable (important for Docker volumes on Synology)
mkdir -p /app/data /app/public/uploads
echo "==> Data directories ready."

# Fix volume ownership if needed (non-root user can't chown, so we try)
if [ -w /app/data ]; then
  echo "==> /app/data is writable."
else
  echo "WARNING: /app/data is NOT writable. Attempting chmod..."
  chmod 755 /app/data 2>/dev/null || true
fi

if [ -w /app/public/uploads ]; then
  echo "==> /app/public/uploads is writable."
else
  echo "WARNING: /app/public/uploads is NOT writable. Attempting chmod..."
  chmod 755 /app/public/uploads 2>/dev/null || true
fi

# Check if prisma CLI exists
PRISMA_CLI="./node_modules/prisma/build/index.js"
if [ ! -f "$PRISMA_CLI" ]; then
  echo "ERROR: Prisma CLI not found at $PRISMA_CLI"
  echo "Contents of /app/node_modules/:"
  ls -la /app/node_modules/ 2>/dev/null || echo "  (empty or missing)"
  echo "Contents of /app/node_modules/prisma/:"
  ls -la /app/node_modules/prisma/ 2>/dev/null || echo "  (empty or missing)"
fi

# Check if prisma client exists
PRISMA_CLIENT="./node_modules/.prisma/client"
if [ ! -d "$PRISMA_CLIENT" ]; then
  echo "ERROR: Prisma Client not found at $PRISMA_CLIENT"
  echo "Contents of /app/node_modules/.prisma/:"
  ls -la /app/node_modules/.prisma/ 2>/dev/null || echo "  (empty or missing)"
fi

# Check if server.js exists
if [ ! -f "./server.js" ]; then
  echo "ERROR: server.js not found in /app/"
  echo "Contents of /app/:"
  ls -la /app/ 2>/dev/null || echo "  (empty)"
  exit 1
fi

echo ""
echo "==> Applying database schema (prisma db push)..."
node "$PRISMA_CLI" db push --skip-generate --accept-data-loss || {
  echo "WARNING: prisma db push failed (non-fatal). Trying with npx..."
  npx prisma db push --skip-generate --accept-data-loss || {
    echo "WARNING: Both prisma db push attempts failed. Starting server anyway..."
  }
}

echo ""
echo "==> Seeding database..."
node /app/docker-seed.js || {
  echo "WARNING: Seed script failed (non-fatal)."
}

echo ""
echo "==> Starting The Venue server on port ${PORT:-3000}..."
echo "========================================="
exec node server.js
