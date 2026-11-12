#!/usr/bin/env bash
# Provide the bundled default chime locally. Never commit the MP3.
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 \"/pfad/zu/deiner.mp3\"" >&2
  exit 1
fi

src="$1"
dest="$(dirname "$0")/../public/chime-default.mp3"

if [ ! -f "$src" ]; then
  echo "Datei nicht gefunden: $src" >&2
  exit 1
fi

cp "$src" "$dest"
echo "OK: $dest ($(du -h "$dest" | cut -f1))"
