#!/usr/bin/env bash
#
# Runs INSIDE the test container as user 'tester' (see run.sh).
# Exercises setup.sh twice: first run must converge the system,
# second run must be a no-op.

set -uo pipefail

export XDG_RUNTIME_DIR="/run/user/$(id -u)"
export PATH="$HOME/.local/share/omarchy/bin:$HOME/.local/bin:$PATH"

SETUP_DIR="$HOME/dotfiles/omarchy-setup"
PASS=0
FAIL=0

check() {
  local desc="$1"; shift
  if "$@" &>/dev/null; then
    echo -e "\e[32mPASS\e[0m $desc"
    ((PASS++))
  else
    echo -e "\e[31mFAIL\e[0m $desc"
    ((FAIL++))
  fi
}

elephant_pid() { systemctl --user show -p MainPID --value elephant; }

# cmp/diff (diffutils) aren't in the arch base image
same_content() { [[ "$(md5sum <"$1")" == "$(md5sum <"$2")" ]]; }

echo "### preparing elephant user service"
systemctl --user daemon-reload
systemctl --user enable --now elephant.service
sleep 2
pid0=$(elephant_pid)
check "elephant running before setup (pid $pid0)" test "$pid0" -gt 0

# Snapshot repo profiles.ini to detect stow --adopt clobbering it
profiles_before=$(md5sum "$HOME/dotfiles/firefox/.mozilla/firefox/profiles.ini" | cut -d' ' -f1)

echo
echo "### first run"
"$SETUP_DIR/setup.sh"
first=$?
echo

check "first run exited 0" test "$first" -eq 0

missing=$(grep -vE '^\s*(#|$)' "$SETUP_DIR/to-install.list" | while read -r p; do pacman -Qi "$p" &>/dev/null || echo -n " $p"; done)
check "all to-install packages present${missing:+ (missing:$missing)}" test -z "$missing"

present=$(grep -vE '^\s*(#|$)' "$SETUP_DIR/to-remove.list" | while read -r p; do pacman -Qi "$p" &>/dev/null && echo -n " $p"; done)
check "all to-remove packages absent${present:+ (present:$present)}" test -z "$present"

check "~/.bashrc stowed" test "$(readlink -f "$HOME/.bashrc")" = "$HOME/dotfiles/terminal/.bashrc"
check "~/.config/nvim stowed (stock config replaced)" test "$(readlink -f "$HOME/.config/nvim")" = "$HOME/dotfiles/terminal/.config/nvim"
check "pwastuis desktop entries stowed" test -e "$HOME/.local/share/applications/WhatsApp.desktop"
check "nvim theme linked to omarchy theme" test "$(readlink "$HOME/.config/nvim/lua/plugins/theme.lua")" = "$HOME/.config/omarchy/current/theme/neovim.lua"
check "firefox-pwa installed" test -x "$HOME/.local/bin/firefox-pwa"
check "omarchy-launch-webapp patched" same_content "$HOME/.local/share/omarchy/bin/omarchy-launch-webapp" "$SETUP_DIR/patch-omarchy/omarchy-launch-webapp"
check "omarchy nvim themes patched" grep -q 'colorscheme("tokyonight' "$HOME/.local/share/omarchy/themes/tokyo-night/neovim.lua"

pid1=$(elephant_pid)
check "elephant restarted after changes (pid $pid0 -> $pid1)" test "$pid1" -gt 0 -a "$pid1" != "$pid0"
check "elephant still active" systemctl --user is-active elephant

profiles_after=$(md5sum "$HOME/dotfiles/firefox/.mozilla/firefox/profiles.ini" | cut -d' ' -f1)
check "repo profiles.ini not clobbered by stow --adopt" test "$profiles_before" = "$profiles_after"

echo
echo "### second run (idempotency)"
out=$("$SETUP_DIR/setup.sh" 2>&1)
second=$?
echo "$out"
echo

check "second run exited 0" test "$second" -eq 0
check "install step reports no work" grep -q "everything already installed" <<<"$out"
check "remove step reports no work" grep -q "nothing to remove" <<<"$out"
check "stow step reports no work" grep -q "already stowed" <<<"$out"
check "launcher restart skipped (no changes)" grep -q "launcher already up to date" <<<"$out"
pid2=$(elephant_pid)
check "elephant not restarted on no-op run (pid $pid1 -> $pid2)" test "$pid2" = "$pid1"
check "~/.config/nvim survived second run" test "$(readlink -f "$HOME/.config/nvim")" = "$HOME/dotfiles/terminal/.config/nvim"

echo
echo "=============================="
echo "PASS: $PASS  FAIL: $FAIL"
echo "=============================="
exit "$((FAIL > 0))"
