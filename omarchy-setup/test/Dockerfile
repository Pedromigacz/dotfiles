# Simulates a fresh-ish omarchy install for testing omarchy-setup/setup.sh.
# Built by run.sh with a clean copy of the dotfiles repo as context.
FROM archlinux:latest

# Omarchy's pacman repo provides yay, elephant, walker, omarchy-nvim, etc.
RUN printf '\n[omarchy]\nSigLevel = Optional TrustAll\nServer = https://pkgs.omarchy.org/stable/$arch\n' >>/etc/pacman.conf \
 && pacman -Syu --noconfirm \
 && pacman -S --noconfirm sudo git yay elephant elephant-desktopapplications elephant-calc elephant-menus elephant-symbols walker

# Packages from to-remove.list, preinstalled so the remove step has real work
RUN pacman -S --noconfirm python-poetry-core tobi-try

RUN useradd -m -u 1000 -G wheel -s /bin/bash tester \
 && echo '%wheel ALL=(ALL) NOPASSWD: ALL' >/etc/sudoers.d/wheel

# Belt and suspenders: mask every unit that touches hardware, the console, or
# kernel state. These already skip themselves in unprivileged containers (ro
# /sys), but masking makes even an accidental --privileged run harmless.
# A privileged run of this container once killed the host Wayland session via
# udev-trigger + vconsole-setup.
RUN systemctl mask \
      systemd-udevd.service systemd-udevd-control.socket systemd-udevd-kernel.socket \
      systemd-udev-trigger.service systemd-vconsole-setup.service \
      systemd-modules-load.service systemd-sysctl.service \
      getty.target console-getty.service

# Docker mounts /sys/fs/cgroup read-only without --privileged; systemd needs
# it writable. Remounting inside the container's private cgroup namespace
# exposes only the container's own subtree — the host tree stays untouchable.
RUN printf '#!/bin/bash\nmount -t cgroup2 -o rw,nosuid,nodev,noexec cgroup2 /sys/fs/cgroup\nexec /sbin/init\n' \
      >/usr/local/bin/boot-systemd \
 && chmod +x /usr/local/bin/boot-systemd

USER tester
WORKDIR /home/tester

# Stand-in for the stock omarchy install: the omarchy checkout, a current
# theme, a stock nvim config, and the elephant user service.
RUN git clone --depth 1 https://github.com/basecamp/omarchy.git /home/tester/.local/share/omarchy \
 && mkdir -p /home/tester/.config/omarchy/current \
 && ln -s /home/tester/.local/share/omarchy/themes/tokyo-night /home/tester/.config/omarchy/current/theme \
 && mkdir -p /home/tester/.config/nvim \
 && echo '-- stock omarchy nvim config' >/home/tester/.config/nvim/init.lua \
 && mkdir -p /home/tester/.config/systemd/user \
 && printf '[Unit]\nDescription=Elephant\n\n[Service]\nExecStart=elephant\nRestart=on-failure\n\n[Install]\nWantedBy=default.target\n' \
      >/home/tester/.config/systemd/user/elephant.service

ENV PATH="/home/tester/.local/share/omarchy/bin:/home/tester/.local/bin:$PATH"

COPY --chown=tester:tester repo /home/tester/dotfiles

USER root
CMD ["/usr/local/bin/boot-systemd"]
