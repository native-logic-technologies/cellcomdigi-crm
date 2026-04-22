#!/usr/bin/env bash
set -e

# Regenerate TypeScript client bindings from the local server module.
# Run this whenever you change server/spacetimedb/src/index.ts

SERVER_PATH="server/spacetimedb"
OUT_DIR="client/src/generated"

echo "Building server module..."
(cd "$SERVER_PATH" && spacetime build)

echo "Generating TypeScript bindings..."
spacetime generate \
  --lang typescript \
  --out-dir "$OUT_DIR" \
  --module-path "$SERVER_PATH" \
  -y

echo "Done. Generated files are in $OUT_DIR"
