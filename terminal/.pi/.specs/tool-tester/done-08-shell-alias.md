# Slice 08 — Shell alias

## Parent

[PRD — Tool Tester TUI](./PRD.md)

## What to build

Add a one-word launch for the tool tester so testing a tool is a low-friction habit.
Add a shell alias to the user's bashrc that runs the standalone script with `bun`,
resolving the script path regardless of the current directory.

## Acceptance criteria

- [ ] A short alias is added to the managed bashrc that launches the tool tester via
      `bun`.
- [ ] The alias works from any working directory (and that directory becomes the
      tester's cwd, per the PRD).
- [ ] The alias is placed consistently with the existing dotfiles bashrc conventions.

## Blocked by

- Blocked by #01 (walking skeleton).
