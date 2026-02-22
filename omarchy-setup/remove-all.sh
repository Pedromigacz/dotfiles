#!/bin/bash

PACKAGES_FILE="$(dirname "$0")/to-remove.packages"

while IFS= read -r line; do
    # Skip comments and empty lines
    [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue

    package="$line"

    if yay -Qi "$package" &>/dev/null; then
        if ! yay -Rns --noconfirm "$package" 2>/tmp/yay_err >/dev/null; then            cat /tmp/yay_err >&2
            cat /tmp/yay_err >&2
            echo "Failed to remove $package ❌"
        else
            echo "$package removed successfully 🗑️"
        fi
    else
        echo "$package was already not installed 🤖"
    fi
done < "$PACKAGES_FILE"