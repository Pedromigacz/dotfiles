# Slice 04 — Rich result rendering

## Parent

[PRD — Tool Tester TUI](./PRD.md)

## What to build

Replace the skeleton's raw result dump with a readable result view, driven by a pure
**result-format** module that turns a tool result into a display model:

- Text content rendered as markdown.
- Structured `details` shown as pretty-printed JSON that can be expanded or collapsed.
- An error banner when the result is flagged as an error.
- A run-duration line.
- A placeholder/metadata line for image content blocks (e.g. `read` on an image),
  rather than dumping binary into the view.

The result step consumes this display model and renders it with the `pi-tui`
components (markdown, text), keeping content fidelity (no lossy reflow of the data the
tester is meant to inspect).

## Acceptance criteria

- [ ] Text content is rendered as markdown in the result view.
- [ ] `details` is shown as readable JSON that can be expanded/collapsed.
- [ ] An error result shows a clear banner distinguishing it from a normal result.
- [ ] The run duration is displayed.
- [ ] An image-returning result shows a placeholder/metadata line and does not corrupt
      the view.
- [ ] `bun test` covers result-format for plain text, text+details, error-flagged, and
      image-containing results through its public interface.

## Blocked by

- Blocked by #01 (walking skeleton).
