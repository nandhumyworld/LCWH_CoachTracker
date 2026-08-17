#!/bin/sh
set -e

# Apply pending DB migrations before the app starts. Safe to run on every boot;
# `migrate deploy` only applies migrations that have not been applied yet.
echo "[entrypoint] Running prisma migrate deploy..."
node node_modules/prisma/build/index.js migrate deploy

echo "[entrypoint] Starting: $*"
exec "$@"
