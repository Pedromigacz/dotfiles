#!/bin/bash

SCRIPT_DIR="$(dirname "$(realpath "$0")")"

rm -rf ~/.config/nvim
# Patch omarchy things I don't like
"$SCRIPT_DIR/patch-omarchy/fix-omarchy-nvim-themes.sh"
"$SCRIPT_DIR/patch-omarchy/patch-webapp.sh"
