#!/bin/bash

PACKAGES_FILE="$(dirname "$0")/to-install.packages"

while IFS= read -r line; do
    # Skip comments and empty lines
    [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue

    package="$line"

    if ! yay -Qi "$package" &>/dev/null; then
        if ! yay -S --noconfirm --needed "$package" 2>/tmp/yay_err >/dev/null; then
            cat /tmp/yay_err >&2
            echo "Failed to install $package ❌"
        else
            echo "$package installed successfully 🤸‍♂"
        fi
    else
        echo "$package is already installed 🤖"
    fi
done < "$PACKAGES_FILE"