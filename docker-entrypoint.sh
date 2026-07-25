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
mkdir -p /app/data "${UPLOAD_DIR:-/app/data/uploads}"
echo "==> Data directories ready."

# Fix volume ownership if needed (non-root user can't chown, so we try)
if [ -w /app/data ]; then
  echo "==> /app/data is writable."
else
  echo "WARNING: /app/data is NOT writable. Attempting chmod..."
  chmod 755 /app/data 2>/dev/null || true
fi

if [ -w "${UPLOAD_DIR:-/app/data/uploads}" ]; then
  echo "==> Upload directory is writable."
else
  echo "WARNING: Upload directory is NOT writable. Attempting chmod..."
  chmod 755 "${UPLOAD_DIR:-/app/data/uploads}" 2>/dev/null || true
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
echo "==> Scheduling first-boot seed..."
# Seeding runs through the app's own /api/seed endpoint rather than a separate
# script, so there is exactly one definition of the default content. It is
# idempotent: existing rooms and menu items are left alone, and any settings
# added by a later release are topped up on every boot.
(
  sleep 8
  node -e "
    const http = require('http');
    http.get('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/seed', (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => console.log('==> Seed:', body.slice(0, 300)));
    }).on('error', (err) => console.log('==> Seed skipped:', err.message));
  "
) &

echo ""
echo "==> Starting The Venue server on port ${PORT:-3000}..."
if [ -z "$ADMIN_PASSWORD" ]; then
  echo "WARNING: ADMIN_PASSWORD is not set — the admin panel is using its"
  echo "         built-in default. Set it before exposing this to the internet."
fi
echo "========================================="
exec node server.js
