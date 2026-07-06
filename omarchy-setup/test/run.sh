#!/usr/bin/env bash
#
# Test omarchy-setup/setup.sh in a fresh-omarchy-like Docker container.
#
#   ./run.sh          build image, boot systemd container, run the test suite
#   KEEP=1 ./run.sh   leave the container running afterwards for inspection
#
# The container runs systemd (privileged) so elephant.service and the
# launcher-refresh step are exercised for real. A named volume caches
# pacman downloads across runs.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
IMAGE=omarchy-setup-test
NAME=omarchy-setup-test

# Build context: tracked + untracked-but-not-ignored files only (the repo
# contains ~200MB of git-ignored state we don't want in the image).
CTX=$(mktemp -d)
cleanup() {
  rm -rf "$CTX"
  if [[ "${KEEP:-0}" != 1 ]]; then
    docker rm -f "$NAME" &>/dev/null || true
  else
    echo "KEEP=1: container '$NAME' left running (docker exec -it $NAME bash)"
  fi
}
trap cleanup EXIT

mkdir -p "$CTX/repo"
git -C "$REPO_ROOT" ls-files -coz --exclude-standard |
  tar -C "$REPO_ROOT" --null -T - -cf - | tar -xf - -C "$CTX/repo"
cp "$SCRIPT_DIR/Dockerfile" "$CTX/"

docker build -t "$IMAGE" "$CTX"

# SAFETY (learned the hard way — three host crashes):
#  - NEVER --cgroupns=host or bind-mount host /sys/fs/cgroup rw: container
#    systemd takes over the host cgroup tree and kills the host session.
#  - NEVER --privileged: it mounts /sys rw, which un-guards the container's
#    udev/vconsole units and they yank the seat/VT from the host compositor.
# Unprivileged + SYS_ADMIN is enough: the image's boot-systemd entrypoint
# remounts a namespaced cgroup2 rw, and hardware-touching units are masked.
docker rm -f "$NAME" &>/dev/null || true
docker run -d --name "$NAME" \
  --cap-add SYS_ADMIN --security-opt seccomp=unconfined \
  --cgroupns=private \
  --tmpfs /run --tmpfs /run/lock --tmpfs /tmp \
  -v omarchy-setup-test-pacman:/var/cache/pacman/pkg \
  "$IMAGE"

echo "waiting for systemd..."
docker exec "$NAME" bash -c '
  for _ in $(seq 30); do
    state=$(systemctl is-system-running 2>/dev/null) || true
    [[ "$state" == running || "$state" == degraded ]] && exit 0
    sleep 1
  done
  echo "systemd did not come up (state: $state)" >&2
  exit 1'

# Give tester a user session manager (needed for systemctl --user)
docker exec "$NAME" loginctl enable-linger tester
docker exec "$NAME" bash -c '
  for _ in $(seq 30); do [[ -S /run/user/1000/bus ]] && exit 0; sleep 1; done
  echo "user session bus never appeared" >&2; exit 1'

docker exec -u tester -w /home/tester \
  -e HOME=/home/tester -e XDG_RUNTIME_DIR=/run/user/1000 \
  "$NAME" /home/tester/dotfiles/omarchy-setup/test/container-test.sh
