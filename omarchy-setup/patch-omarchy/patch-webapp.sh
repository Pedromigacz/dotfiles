#!/usr/bin/env bash
set -euo pipefail

BINARY_NAME="firefox-pwa"
INSTALL_DIR="$HOME/.local/bin"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="$SCRIPT_DIR/$BINARY_NAME"

# Check source binary exists
if [[ ! -f "$SOURCE" ]]; then
  echo "Error: '$BINARY_NAME' not found next to this script (expected at $SOURCE)"
  exit 1
fi

# Create install dir if needed
mkdir -p "$INSTALL_DIR"

# Copy and make executable
cp "$SOURCE" "$INSTALL_DIR/$BINARY_NAME"
chmod +x "$INSTALL_DIR/$BINARY_NAME"

echo "Installed: $INSTALL_DIR/$BINARY_NAME"

# Warn if not in PATH
if ! echo "$PATH" | grep -q "$INSTALL_DIR"; then
  echo "Warning: '$INSTALL_DIR' is not in your PATH."
fi
