#!/usr/bin/env bash
# Check if the current window has a pane titled "opencode".

set -e

opencode_pane=$(tmux list-panes -F '#{pane_id} #{pane_title}' | awk '/OpenCode/ {print $1; exit}')

if [ -n "$opencode_pane" ]; then
    # Find a pane in the current window that is NOT opencode and focus it
    other_pane=$(tmux list-panes -F '#{pane_id} #{pane_title}' | awk '!/OpenCode/ {print $1; exit}')
    if [ -n "$other_pane" ]; then
        tmux select-pane -t "$other_pane"
    fi
    # Break the opencode pane out into its own window
    tmux break-pane -d -s "$opencode_pane" -n opencode
else
    tmux join-pane -h -l 20% -s opencode
fi