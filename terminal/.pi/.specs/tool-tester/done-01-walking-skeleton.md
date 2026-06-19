# Slice 01 — Walking skeleton

## Parent

[PRD — Tool Tester TUI](./PRD.md)

## What to build

The thinnest end-to-end path through the whole tool tester: a standalone script,
launchable with `bun`, that starts a `pi-tui` application, discovers the real tools a
pi session exposes, lets me pick one, runs it for real, and shows me the result —
then quits cleanly.

Concretely, this slice stands up the spine every later slice thickens:

- **Discovery (tool-harvest):** create an in-memory agent session via the pi SDK
  (`createAgentSession`) with no model selected, read its tool list, and dispose the
  session. No provider credentials required to start.
- **List step:** a full-screen, fuzzy-filterable list of the discovered tools.
- **Run (tool-runner):** selecting a tool runs it through pi's real `execute`,
  supplying a synthesized tool-call id and the abort signal + update callback plumbing
  (even if not yet wired to UI). For this slice, tools are invoked with empty/default
  params, so it is demoed against a no-required-argument tool such as `ls`.
- **Result step:** dump the raw result — content text as-is plus stringified
  `details` — and an error indication if the tool threw.
- **Chrome:** the working directory is shown in the header; quitting restores the
  terminal and disposes the session.

Parameter entry and rich rendering are intentionally stubbed here (later slices).

## Acceptance criteria

- [ ] Running the script with `bun` launches a full-screen TUI without requiring any
      API key or model selection.
- [ ] The list shows every tool the pi session exposes (built-ins and local
      extensions) and can be narrowed by typing.
- [ ] Selecting a no-required-argument tool (e.g. `ls`) executes the real tool and
      displays its returned content and details.
- [ ] A tool that throws is shown as an error rather than crashing the app.
- [ ] The header displays the current working directory.
- [ ] Quitting restores the terminal cleanly and disposes the harvested session.
- [ ] `bunx tsc --noEmit` over the agent tsconfig is clean.

## Blocked by

None - can start immediately.
