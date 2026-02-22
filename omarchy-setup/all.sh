#!/bin/bash

SCRIPT_DIR="$(dirname "$(realpath "$0")")"

"$SCRIPT_DIR/to-install.sh"
"$SCRIPT_DIR/to-remove.sh"
"$SCRIPT_DIR/to-stow.sh"
