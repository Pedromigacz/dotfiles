#!/usr/bin/env bash
set -euo pipefail

BINARY_NAME="firefox-pwa"
INSTALL_DIR="$HOME/.local/bin"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="$SCRIPT_DIR/$BINARY_NAME"
FIREFOX_PROFILE_NAME="pwas"

# Check source binary exists
if [[ ! -f "$SOURCE" ]]; then
  echo "Error: '$BINARY_NAME' not found next to this script (expected at $SOURCE)"
  exit 1
fi

# Check firefox is available
if ! command -v firefox &>/dev/null; then
  echo "Error: 'firefox' not found in PATH. Cannot create profile."
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

# Create Firefox profile "pwas" if it doesn't already exist
PROFILES_INI="$HOME/.mozilla/firefox/profiles.ini"
if [[ -f "$PROFILES_INI" ]] && grep -q "Name=$FIREFOX_PROFILE_NAME" "$PROFILES_INI"; then
  echo "Firefox profile '$FIREFOX_PROFILE_NAME' already exists, skipping."
else
  echo "Creating Firefox profile '$FIREFOX_PROFILE_NAME'..."
  firefox --headless --createProfile "$FIREFOX_PROFILE_NAME $HOME/.mozilla/firefox/profile.$FIREFOX_PROFILE_NAME" 2>/dev/null
  echo "Firefox profile '$FIREFOX_PROFILE_NAME' created."
fi

