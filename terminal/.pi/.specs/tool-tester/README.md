# Tool Tester TUI — vertical slices

Build a standalone terminal UI for manually invoking each pi coding-agent tool, with
auto-detection of every tool a live pi session exposes. Full design in
[PRD.md](./PRD.md).

Each file below is a **vertical slice**: a thin, end-to-end tracer bullet through the
whole pipe (discover → list → enter params → execute the real tool → render → teardown)
that is independently grabbable and verifiable. Each later slice thickens the spine the
walking skeleton establishes.

## Slices

| # | Slice | Type | Blocked by |
|---|---|---|---|
| 01 | [Walking skeleton](./01-walking-skeleton.md) | AFK | — |
| 02 | [Generated form (primitives)](./02-generated-form-primitives.md) | AFK | 01 |
| 03 | [JSON-fallback fields](./03-json-fallback-fields.md) | AFK | 02 |
| 04 | [Rich result rendering](./04-rich-result-rendering.md) | AFK | 01 |
| 05 | [Live streaming & cancellation](./05-streaming-and-cancellation.md) | AFK | 01 (soft: 04) |
| 06 | [Param persistence](./06-param-persistence.md) | AFK | 02 |
| 07 | [Tool source labels](./07-tool-source-labels.md) | AFK | 01 |
| 08 | [Shell alias](./08-shell-alias.md) | AFK | 01 |

Slices 04, 07, and 08 only depend on the skeleton and can proceed in parallel with the
form work (02/03).

## Shared context

- **Packaging:** a single standalone script in the pi agent directory, run with `bun`,
  launchable via a shell alias (slice 08). It is its own process and TUI, decoupled
  from any running pi instance.
- **Discovery:** materialize the real tool set by creating an in-memory agent session
  (`createAgentSession`) and reading its tool list, then disposing the session. No
  model is selected and no prompt is sent, so **no provider credentials are required**
  to start.
- **Deep modules (pure / isolable):** `schema-form` (schema → form fields),
  `validation` (form values → validated params via `typebox/value`), `result-format`
  (tool result → display model), and `tool-runner` (execute adapter: tool-call id,
  argument-prep shim, timing, error capture). The thin glue — `tool-harvest`,
  `param-store`, and the `tui-app` wizard controller — is validated by manual use.
- **UI runtime:** `pi-tui` (`ProcessTerminal` + `TUI` and its components). Layout is a
  full-screen three-step wizard (list → form → result); Escape walks back when idle.
- **Safety:** no guardrails — running a tool executes immediately, including
  filesystem-mutating tools, which act on the launch directory (shown in the header).
- **Dependencies:** only packages already present for the agent extensions
  (`@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`, `typebox`); validation
  uses the `typebox/value` module.

## Testing

`bun test`, asserting external behavior through each module's public interface (no
implementation-detail assertions). Tests are prescribed for the four pure/logic modules
only — `schema-form` and `validation` (slices 02–03), `result-format` (slice 04), and
`tool-runner` (slice 01). There is no prior test art in this repo; these establish the
pattern with colocated `*.test.ts` files.

## Definition of done (whole feature)

All eight slices complete; `bunx tsc --noEmit -p terminal/.pi/agent/tsconfig.json` is
clean; `bun test` passes for the four tested modules; the tester launches via its alias,
auto-detects every tool, and can run each tool end-to-end with results rendered per the
PRD.
