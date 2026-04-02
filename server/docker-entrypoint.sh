#!/bin/sh
set -eu

# Ensure upload directories exist and are writable for the runtime user.
mkdir -p /app/uploads/avatars
chown -R node:node /app/uploads

# Keep the app process non-root.
exec su-exec node "$@"
