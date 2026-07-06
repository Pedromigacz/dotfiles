#!/usr/bin/env bash
#
# Omarchy setup — safe to run on a fresh install or an already-customized one.
#
#   ./setup.sh            run everything
#   ./setup.sh install    run a single step (install|remove|pre-stow|stow|post-stow|refresh)
#
# Steps are driven by the declarative lists next to this script:
#   to-install.list   packages that must be present   (installed via yay)
#   to-remove.list    packages that must be absent    (removed via yay -Rns)
#   to-stow.list      dotfile packages to stow into $HOME
#
# After any change, elephant/walker are restarted so the launcher reflects
# the new state of the system.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

CHANGED=0
FAILURES=()

ok()   { echo -e "  \e[32m✔\e[0m $*"; }
skip() { echo -e "  \e[2m∙ $*\e[0m"; }
fail() { echo -e "  \e[31m✘ $*\e[0m" >&2; FAILURES+=("$*"); }
step() { echo -e "\n\e[1m==> $*\e[0m"; }

# Print list entries, skipping comments and blank lines
read_list() {
  grep -vE '^\s*(#|$)' "$1"
}

require() {
  command -v "$1" &>/dev/null || { echo "Error: '$1' is required but not found in PATH." >&2; exit 1; }
}

installed() {
  pacman -Q "$1" &>/dev/null
}

step_install() {
  step "Installing packages (to-install.list)"

  local pkg missing=()
  while IFS= read -r pkg; do
    installed "$pkg" || missing+=("$pkg")
  done < <(read_list "$SCRIPT_DIR/to-install.list")

  if ((${#missing[@]} == 0)); then
    skip "everything already installed"
    return
  fi

  echo "  installing: ${missing[*]}"
  yay -S --noconfirm --needed "${missing[@]}"

  for pkg in "${missing[@]}"; do
    if installed "$pkg"; then
      ok "$pkg installed"
      CHANGED=1
    else
      # Batch install failed somewhere; retry alone so the error is attributable
      if yay -S --noconfirm --needed "$pkg"; then
        ok "$pkg installed"
        CHANGED=1
      else
        fail "install $pkg"
      fi
    fi
  done
}

step_remove() {
  step "Removing packages (to-remove.list)"

  local pkg present=()
  while IFS= read -r pkg; do
    installed "$pkg" && present+=("$pkg")
  done < <(read_list "$SCRIPT_DIR/to-remove.list")

  if ((${#present[@]} == 0)); then
    skip "nothing to remove"
    return
  fi

  echo "  removing: ${present[*]}"
  yay -Rns --noconfirm "${present[@]}" || true

  for pkg in "${present[@]}"; do
    if installed "$pkg"; then
      # Batch removal can fail as a whole (e.g. dependency conflicts); retry alone
      if yay -Rns --noconfirm "$pkg"; then
        ok "$pkg removed"
        CHANGED=1
      else
        fail "remove $pkg"
      fi
    else
      ok "$pkg removed"
      CHANGED=1
    fi
  done
}

step_pre_stow() {
  step "Patching omarchy defaults"

  # Clear omarchy's nvim config unless it already points into this repo
  if [[ -e "$HOME/.config/nvim" && "$(readlink -f "$HOME/.config/nvim" 2>/dev/null)" != "$REPO_ROOT"/* ]]; then
    rm -rf "$HOME/.config/nvim"
    ok "removed stock ~/.config/nvim"
    CHANGED=1
  fi

  local patch
  for patch in fix-omarchy-nvim-themes.sh patch-webapp.sh; do
    if "$SCRIPT_DIR/patch-omarchy/$patch"; then
      ok "$patch"
    else
      fail "$patch"
    fi
  done
}

step_stow() {
  step "Stowing dotfiles (to-stow.list)"
  require stow

  # --restow always unlinks and relinks every entry, so its verbose output
  # can't tell a no-op from real work. Detect work with a plain dry run
  # (silent when everything is already stowed), then restow only if needed.
  # Limitation: links whose repo file was deleted are only pruned when some
  # other change triggers the restow.
  local pkg out
  while IFS= read -r pkg; do
    if ! out=$(stow -nv --adopt -d "$REPO_ROOT" -t "$HOME" "$pkg" 2>&1); then
      echo "$out" >&2
      fail "stow $pkg"
      continue
    fi
    if ! grep -qE '^(LINK|UNLINK|MV)' <<<"$out"; then
      skip "$pkg already stowed"
      continue
    fi
    if out=$(stow -v --restow --adopt -d "$REPO_ROOT" -t "$HOME" "$pkg" 2>&1); then
      ok "$pkg stowed (links updated)"
      CHANGED=1
    else
      echo "$out" >&2
      fail "stow $pkg"
    fi
  done < <(read_list "$SCRIPT_DIR/to-stow.list")

  # --adopt moves pre-existing target files into the repo; make that visible
  if git -C "$REPO_ROOT" rev-parse --is-inside-work-tree &>/dev/null && ! git -C "$REPO_ROOT" diff --quiet; then
    echo -e "  \e[33m!\e[0m stow --adopt modified the repo; review with: git -C $REPO_ROOT diff"
  fi
}

step_post_stow() {
  step "Post-stow wiring"
  mkdir -p "$HOME/.config/nvim/lua/plugins"
  ln -sf "$HOME/.config/omarchy/current/theme/neovim.lua" "$HOME/.config/nvim/lua/plugins/theme.lua"
  ok "nvim theme linked to omarchy current theme"
}

step_refresh() {
  step "Refreshing launcher (elephant/walker)"

  if ((CHANGED == 0)); then
    skip "no changes; launcher already up to date"
    return
  fi

  if command -v omarchy-restart-walker &>/dev/null; then
    if omarchy-restart-walker; then
      ok "elephant + walker restarted"
    else
      fail "omarchy-restart-walker"
    fi
  elif systemctl --user is-enabled elephant.service &>/dev/null; then
    if systemctl --user restart elephant.service; then
      ok "elephant restarted"
    else
      fail "restart elephant.service"
    fi
  else
    skip "elephant not managed by systemd; nothing to restart"
  fi
}

main() {
  require yay

  case "${1:-all}" in
    install)   step_install ;;
    remove)    step_remove ;;
    pre-stow)  step_pre_stow ;;
    stow)      step_stow ;;
    post-stow) step_post_stow ;;
    refresh)   CHANGED=1; step_refresh ;;
    all)
      step_install
      # Removals run only after a clean install. A failed install can mean a
      # replacement package (e.g. the terminal that supersedes another) never
      # landed; tearing down its predecessor anyway would strand the system
      # with no working component. Abort before any removal if install failed.
      if ((${#FAILURES[@]} > 0)); then
        echo
        echo -e "\e[31mInstall step failed; skipping removals so a package isn't torn down before its replacement is installed.\e[0m" >&2
        printf '  - %s\n' "${FAILURES[@]}" >&2
        exit 1
      fi
      step_remove
      step_pre_stow
      step_stow
      step_post_stow
      step_refresh
      ;;
    *)
      echo "Usage: $0 [install|remove|pre-stow|stow|post-stow|refresh]" >&2
      exit 2
      ;;
  esac

  echo
  if ((${#FAILURES[@]} > 0)); then
    echo -e "\e[31mCompleted with ${#FAILURES[@]} failure(s):\e[0m"
    printf '  - %s\n' "${FAILURES[@]}"
    exit 1
  fi
  echo -e "\e[32mAll done 🤸\e[0m"
}

main "$@"
