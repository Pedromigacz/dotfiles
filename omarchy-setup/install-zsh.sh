#!/bin/bash

# Install Zsh
if ! command -v zsh &>/dev/null; then
    yay -S --noconfirm --needed zsh
    echo "Zsh installed successfully 🤸‍♂"
else
    echo "Zsh is already installed 🤖"
fi