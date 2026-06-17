# Slice 03 — Configurable defaults from pi settings

## Value

Sensible defaults vary by user and by project: someone may always want a larger
character budget, a shorter timeout, or a specific default format. Reading defaults
from pi's settings lets users tune behavior once instead of passing the same
arguments on every call.

## Outcome

`web_fetch` reads default values from `~/.pi/agent/settings.json` (global) and the
project's `.pi/settings.json` (project), with project overriding global and explicit
tool arguments overriding both.

## Scope

- Add a settings loader that reads both files, tolerates missing/invalid files, and
  validates each value's type before using it.
- Support defaults for: max characters, request timeout, default output format, and
  (once later slices land) browser/OS fingerprint and batch concurrency.
- Resolve precedence as: explicit tool argument > project setting > global setting >
  built-in default.
- Namespace the keys clearly (e.g. a `webFetch*` prefix) and document them in the
  extension header and `.specs` README.

## Acceptance criteria

- With no settings files present, behavior matches the built-in defaults.
- A global setting changes the default for a call that omits that argument.
- A project `.pi/settings.json` value overrides the global value.
- An explicit tool argument overrides both settings files.
- Malformed or wrong-typed settings values are ignored (fall back to the next level)
  without throwing or breaking the tool.

## Edge cases

- `settings.json` contains unrelated keys — ignore them.
- A value present but of the wrong type (e.g. string where a number is expected) —
  treat as absent.
- Running outside any project (no `.pi/settings.json`) — global + built-ins only.

## Out of scope

- A UI/command for editing settings.
- Hot-reloading settings mid-session (read at call time is sufficient).

## Technical notes

- Mirror the upstream `settings.ts` shape: a `normalize` step that type-checks each
  key, then a `resolve` step that merges project over global. Use `getAgentDir()` for
  the global path and `ctx.cwd` for the project path.
