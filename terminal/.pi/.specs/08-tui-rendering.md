# Slice 08 — Rich TUI rendering & progress

## Value

Right now a `web_fetch` call is opaque while it runs and dumps a wall of text when it
finishes. The upstream package shows a live spinner + progress bar during the fetch and
a clean, collapsible result (title/metadata header, short preview, expand-to-see-all,
syntax-highlighted content). That makes the tool pleasant to watch and keeps the
transcript readable — most of upstream's `index.ts` is exactly this.

## Outcome

`web_fetch` (and `batch_web_fetch`) render live progress while fetching and a compact,
expandable result in the pi TUI, without changing what the model receives.

## Scope

- Emit progress through `onUpdate` with phase/status info (connecting → loading →
  processing → done).
- Implement `renderCall` to show the tool name + target URL.
- Implement `renderResult` to show: a metadata header (title, published, etc.), a short
  content preview when collapsed, an expand hint, and full content when expanded.
- Use syntax highlighting for `markdown`/`html`/`json` formats via pi's markdown theme.
- For `batch_web_fetch`, render a per-item progress list (status glyph + URL + bar) and
  a summary line.
- The text content sent to the model is unchanged by rendering (presentation only).

## Acceptance criteria

- During a fetch, the TUI shows an animated spinner/progress indicator that advances and
  stops on completion.
- A completed single fetch shows a metadata header and a truncated preview, with a
  documented key to expand to full content.
- `batch_web_fetch` shows one progress row per URL and an overall `done/ok/err` summary.
- Error results render a concise, readable error line rather than a raw stack/dump.
- The model-facing `content` is identical whether or not custom rendering is active.

## Edge cases

- Narrow terminals — rows must truncate URLs/bars responsively without wrapping garbage.
- Very long content — collapsed preview stays bounded; expansion shows the rest.
- Spinner timer must be cleared on completion/error so it never leaks across turns.

## Out of scope

- Interactive controls beyond pi's standard expand/collapse.
- Theming choices beyond reusing the existing pi markdown/theme tokens.

## Depends on

- Slice 01 (metadata to display). Composes with 02 (format-aware highlighting) and
  05 (batch progress) when those are present.

## Technical notes

- This is the largest slice by line count but adds no dependencies — it is pure
  `renderCall`/`renderResult`/`onUpdate` work against `@earendil-works/pi-tui`
  (`Text`, `Container`, `Markdown`, `Spacer`). Mirror upstream `index.ts` for the
  progress-bar/spinner/preview structure.
