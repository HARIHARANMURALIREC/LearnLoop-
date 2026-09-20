#!/bin/sh
# Platform-neutral logic is written once in web/src/lib and copied here so web and mobile can't drift.
# Run after editing any of these files on web.
cd "$(dirname "$0")/.."
for f in types scoring ai weak resources streak srs flashcards fillers useActivity; do
  { echo "// AUTO-COPIED from web/src/lib/$f.ts by scripts/sync-shared.sh — edit the web file, not this one."; cat "../web/src/lib/$f.ts"; } > "src/lib/$f.ts"
done
