#!/bin/bash

REPO_ROOT="$(realpath "$(dirname "${BASH_SOURCE[0]}")/..")"
STOW_FILE="$(dirname "${BASH_SOURCE[0]}")/to-stow.list"

is_stow_installed() {
  pacman -Qi "stow" &> /dev/null
}

if ! is_stow_installed; then
  echo "Install stow first"
  exit 1
fi

while IFS= read -r line; do
    [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue

    if ! stow --restow --adopt -d "$REPO_ROOT" -t "$HOME" "$line"; then
        echo "Failed to stow $line 😞"
    else
        echo "$line stowed successfully 🤸‍♂"
    fi
done < "$STOW_FILE"