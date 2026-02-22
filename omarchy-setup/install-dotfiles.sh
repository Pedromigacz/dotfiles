#!/bin/bash

REPO_ROOT="$(realpath "$(dirname "${BASH_SOURCE[0]}")/..")"

is_stow_installed() {
  pacman -Qi "stow" &> /dev/null
}

if ! is_stow_installed; then
  echo "Install stow first"
  exit 1
fi

stow --restow --adopt -d "$REPO_ROOT" -t "$HOME" ghostty nvim tmux zshrc starship
echo "Successfully stowed ghostty, nvim, tmux, zshrc and starship"

