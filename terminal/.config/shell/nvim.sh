nvim() {
  if [ -z "$TMUX" ]; then
    tmux new-session -A -s main -n nvim \; \
      send-keys "nvim $*" Enter \; \
      new-window -n opencode \; \
      send-keys "opencode" Enter \; \
      select-window -t 1
  else
    command nvim "$@"
  fi
}

