# PRD — Tool Tester TUI

A standalone terminal UI for manually invoking each pi coding-agent tool, with
auto-detection of every tool a live pi session exposes.

## Problem Statement

I develop and customize pi's tools as local extensions (`read`, `bash`, `edit`,
`write`, `grep`, `find`, `ls`, `web_fetch`, and whatever I add next). Today the only
way to exercise one is to start a full pi session and coax the model into calling it
with the arguments I have in mind — which is slow, costs a model round-trip, is
non-deterministic (the model picks the args, not me), and gives me no clean view of
exactly what the tool returned. There is no direct, repeatable way to drive a single
tool with chosen parameters and inspect its raw result while I iterate on its
implementation.

## Solution

A standalone terminal application I launch from the shell that auto-detects every
tool pi would run, lets me pick one from a list, fills in its parameters through a
form generated from the tool's own schema, runs the tool directly with those exact
parameters, and shows me the result (and any streamed progress) richly rendered. It
remembers what I last typed for each tool so re-running across sessions is fast. It
talks to the real tool implementations pi uses — no model, no API key, no guesswork
about arguments.

## User Stories

1. As a pi extension developer, I want the tool tester to auto-detect every tool a
   real pi session exposes, so that I never have to manually register or list tools
   to test them.
2. As a developer, I want both pi's built-in tools and my local extension tools to
   appear, so that I can test the complete set that pi actually runs.
3. As a developer, I want each listed tool labeled with its source, so that when a
   built-in and an extension share a name I can see which one the session resolved.
4. As a developer, I want to launch the tester with a single short command from any
   directory, so that testing a tool is a low-friction habit.
5. As a developer, I want the tester to start without needing API credentials or a
   selected model, so that I can test tools offline and instantly.
6. As a developer, I want to browse the available tools in a list, so that I can see
   everything I can test at a glance.
7. As a developer, I want to fuzzy-filter the tool list by typing, so that I can jump
   to a tool quickly when there are many.
8. As a developer, I want to select a tool and advance to its parameter form, so that
   I can prepare a specific invocation.
9. As a developer, I want the parameter form generated from the tool's own schema, so
   that I always see exactly the fields that tool accepts.
10. As a developer, I want type-appropriate inputs for each field (text, number,
    boolean), so that entering valid values is natural.
11. As a developer, I want required fields marked, so that I know what I must supply
    before running.
12. As a developer, I want each field's description shown, so that I understand what
    the tool expects without reading source.
13. As a developer, I want default values pre-filled from the schema, so that I only
    change what I care about.
14. As a developer, I want non-primitive fields (arrays/objects, e.g. `edit`'s list
    of edits) presented as a small JSON editor for just that field, so that I can
    still supply complex inputs without the form breaking.
15. As a developer, I want my input validated against the tool's schema before it
    runs, so that I catch mistakes before invoking the tool.
16. As a developer, I want validation errors shown clearly next to the problem, so
    that I can fix them quickly.
17. As a developer, I want to run the tool with my entered parameters by pressing a
    single key, so that invocation is immediate.
18. As a developer, I want the tool executed through pi's real tool implementation,
    so that what I observe matches production behavior exactly.
19. As a developer, I want the current working directory shown in the header, so that
    I always know where filesystem tools (`bash`, `write`, `edit`, `read`) will
    operate.
20. As a developer, I want tools that stream progress to update the result view live
    as they run, so that I can watch long-running operations like fetches or shell
    commands.
21. As a developer, I want the tool's text output rendered as markdown, so that
    structured results are easy to read.
22. As a developer, I want the tool's structured `details` shown as readable JSON that
    I can expand or collapse, so that I can inspect metadata without it dominating the
    screen.
23. As a developer, I want errors clearly flagged with a banner, so that I immediately
    see when a tool threw instead of returning a normal result.
24. As a developer, I want the run duration shown, so that I have a sense of each
    tool's performance.
25. As a developer, I want to cancel a running tool with Ctrl-C, so that I can abort a
    hung or long operation without killing the whole app.
26. As a developer, I want canceling a run to actually signal the tool via its abort
    signal, so that well-behaved tools stop their work.
27. As a developer, I want to step back from the result to the form, and from the form
    to the list, with Escape, so that I can adjust parameters or pick another tool
    without restarting.
28. As a developer, I want my last-used parameters for each tool saved to disk, so
    that re-running the same invocation later is effortless.
29. As a developer, I want the form to pre-fill with my last-used values for a tool
    when I reopen it, falling back to schema defaults the first time, so that I rarely
    retype.
30. As a developer, I want to re-run a tool repeatedly with tweaks, so that I can
    iterate on its behavior or my inputs quickly.
31. As a developer, I want to quit the app cleanly, so that the terminal is restored
    and the throwaway session is disposed.
32. As a developer, I want a synthesized tool-call id supplied per run, so that tools
    that key on it behave normally.
33. As a developer, I want image-returning tools (e.g. `read` on an image) to at least
    show a placeholder/metadata line rather than garbling the view, so that the app
    stays usable for those tools.

## Implementation Decisions

**Packaging & launch**

- Ships as a single standalone script in the pi agent directory, run with `bun`, with
  a shell alias added to the user's bashrc for one-word launch.
- Fully decoupled from any running pi instance; it is its own process and TUI.

**Tool discovery**

- Discovery materializes the real tool set by creating an in-memory agent session via
  pi's SDK (`createAgentSession`) and reading the session's tool list, then disposing
  the session.
- No model is selected and no prompt is ever sent, so no provider credentials are
  required to start; the session exists only to surface tools with their real bound
  context.
- Each discovered tool carries its name, label, description, parameter schema, and an
  `execute` callable; the app labels each entry with its source so name collisions
  (built-in vs. extension) are visible.

**Module decomposition** (deep, isolable logic separated from glue):

- **schema-form** — pure transform from a TypeBox schema to an ordered list of form
  field descriptors. Each descriptor carries the field's key, widget kind (string /
  number / integer / boolean), required flag, description, and default. Any
  non-primitive field (array/object/union/etc.) is marked as a JSON-fallback field
  carrying its sub-schema.
- **validation** — pure assembly of form widget + JSON-fallback values into a
  candidate params object, validated and coerced against the tool's schema using
  `typebox/value` (defaults applied, type checks, error extraction). Returns either a
  validated params object or a list of field-scoped errors.
- **result-format** — pure transform from a tool result (`content[]`, `details`,
  `isError`) plus timing into a display model: markdown for text content, pretty JSON
  for details, an error banner flag, a duration line, and a placeholder for image
  content blocks.
- **tool-runner** — execution adapter that synthesizes a tool-call id, applies the
  tool's optional argument-preparation shim, invokes `execute` with the abort signal
  and an update callback, times the call, and captures a thrown error into an
  error-flagged result. Depends only on an injected tool-like interface.
- **param-store** — load/save of last-used parameters per tool name to a JSON file in
  the pi agent config directory; tolerates a missing or corrupt file by falling back
  to empty state.
- **tool-harvest** — thin adapter wrapping session creation, tool extraction, and
  disposal behind a simple "give me the tools" call.
- **tui-app** — wizard controller built on pi's TUI toolkit (`pi-tui`): owns step
  state (list → form → result), key handling, component wiring, and orchestration of
  the modules above.

**UX & flow**

- Three-step wizard, each step full-screen: a fuzzy-filterable tool list; a generated
  parameter form; a result view. Escape walks back one step when idle.
- The working directory is shown persistently in the header. There are no mutation
  guardrails — pressing the run key executes immediately, including for filesystem-
  mutating tools, which operate on the launch directory.
- During a run, Ctrl-C aborts via the tool's abort signal; Escape only navigates back
  when no run is in flight.
- The result view renders text content as markdown and `details` as expandable/
  collapsible pretty JSON, with an error banner when the result is flagged as an error
  and a run-duration line. Tools that stream partial results re-render the view live.

**Persistence**

- Last-used parameters are persisted per tool to a JSON file under the pi agent config
  directory and used to pre-fill the form on reopen, falling back to schema defaults.

## Testing Decisions

- Tests assert **external behavior through each module's public interface**, never
  internal structure. Given an input, assert the returned value; do not reach into
  private state or assert on how the result was computed. The four pure/adapter
  modules are designed to make this possible without a terminal or a live session.
- **Test runner:** `bun test` (built into the toolchain already in use; zero extra
  configuration). There is no existing test prior art in this repo, so these tests
  establish the pattern: colocated `*.test.ts` files exercising a module's exported
  functions with plain assertions.
- **Modules under test (the four pure/logic modules):**
  - **schema-form** — given representative TypeBox schemas (all-primitive like
    `web_fetch`; a schema with an array-of-objects field like `edit`; schemas with
    optionals and defaults), assert the produced field descriptors: correct widget
    kinds, required flags, descriptions, defaults, and that non-primitive fields are
    marked as JSON-fallback with their sub-schema.
  - **validation** — given a schema and a set of widget/JSON values, assert it returns
    a correctly coerced params object when valid (including defaults applied), and a
    list of field-scoped errors when invalid (missing required, wrong type, malformed
    JSON in a fallback field).
  - **result-format** — given representative tool results (plain text content; content
    plus rich details; an error-flagged result; a result containing an image block),
    assert the display model: markdown text, pretty-printed details, error banner
    flag, duration line, and image placeholder.
  - **tool-runner** — using a fake tool implementing the tool interface, assert it
    synthesizes a call id, applies the preparation shim when present, forwards the
    abort signal and update callback, reports timing, and converts a thrown error into
    an error-flagged result rather than propagating the throw.
- **Not unit-tested** (by decision): `param-store`, `tool-harvest`, and `tui-app`.
  These are thin I/O / session glue / terminal glue and are validated by manual use.

## Out of Scope

- Any LLM/model involvement: the tester never prompts a model or chooses arguments
  automatically.
- Mutation safety features (scratch/sandbox directories, confirmation prompts,
  dry-run): filesystem tools run for real against the launch directory.
- Switching the working directory from within the app, or per-tool cwd overrides.
- A two-pane or three-pane layout; the agreed layout is the full-screen wizard.
- Editing or saving tool definitions; the tester only invokes existing tools.
- Full repeatable sub-forms for nested/array fields and a global raw-JSON mode; the
  agreed approach is per-field JSON fallback only.
- Rich in-terminal image rendering; image content blocks get a placeholder/metadata
  line.
- Persisting full run history or named param presets; only the single last-used param
  set per tool is stored.
- Integration tests driving the TUI through a fake terminal, and discovery integration
  tests against a real session.

## Further Notes

- The four built-in-named extension tools (`read`, `bash`, `edit`, `write`, `grep`,
  `find`, `ls`) currently bind to the process working directory at load time rather
  than a session-provided cwd; this is why the working directory shown in the header
  is the launch directory and why mutating tools act there.
- The tester depends only on packages already present for the agent extensions
  (`@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`, `typebox`); validation
  uses the `typebox/value` value module.
- Feature lives under the agent directory so it type-checks with the existing
  `tsconfig.json`; verify with the project's existing type-check command before
  considering it done.
- Cancellation semantics depend on each tool honoring its abort signal; tools that
  ignore it will continue until completion even after Ctrl-C requests abort.
