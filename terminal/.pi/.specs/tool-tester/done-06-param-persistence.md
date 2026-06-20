# Slice 06 — Param persistence

## Parent

[PRD — Tool Tester TUI](./PRD.md)

## What to build

Remember what I last entered for each tool so re-running across launches is fast,
driven by a thin **param-store** module.

- On a successful run, persist the entered params for that tool to a JSON file under
  the pi agent config directory, keyed by tool name.
- When I open a tool's form, pre-fill it with my last-used params for that tool,
  falling back to schema defaults the first time (or when no stored value exists).
- A missing or corrupt store file is tolerated — the app falls back to empty state
  rather than failing to launch.

## Acceptance criteria

- [ ] Running a tool writes its entered params to the store file, keyed by tool name.
- [ ] Reopening a tool's form pre-fills the last-used params for that tool.
- [ ] A tool with no stored params falls back to schema defaults.
- [ ] A missing or corrupt store file does not prevent the app from launching; it
      starts with empty state.
- [ ] The last-used values survive across separate launches of the app.

## Blocked by

- Blocked by #02 (generated form — primitives).
