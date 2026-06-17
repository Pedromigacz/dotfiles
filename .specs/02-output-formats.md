# Slice 02 — Output format selection

## Value

Different tasks want different shapes of the same page: readable prose for
summarizing, cleaned HTML for structure-aware parsing, plain text for cheap token
use, or the untouched response for custom handling. One `format` parameter lets the
agent ask for what it needs instead of always getting one fixed rendering.

## Outcome

`web_fetch` accepts a `format` parameter — `markdown` | `html` | `text` | `json` |
`raw` — and shapes the returned content accordingly, defaulting to `markdown`.

## Scope

- Add an optional `format` parameter to the tool schema with the five values above.
- `markdown`: extracted content as readable markdown (default).
- `html`: cleaned/extracted HTML.
- `text`: markdown stripped to plain text.
- `json`: structured object (metadata + content) serialized as JSON.
- `raw`: the full server response body, no extraction and no truncation.
- Replace the current boolean `raw` flag with `format: "raw"` (keep `raw` accepted as
  a deprecated alias mapping to `format: "raw"`).

## Acceptance criteria

- Each of the five formats returns content in the documented shape for the same URL.
- `format` defaults to `markdown` when omitted.
- `raw` returns the unmodified, untruncated body and notes that truncation was skipped.
- `json` output is valid parseable JSON containing both metadata and content.
- The legacy `raw: true` boolean still works and maps to `format: "raw"`.
- The tool description / `promptSnippet` documents the available formats so the model
  knows when to pick each.

## Edge cases

- `raw` on a very large response — no truncation by contract; document that this can
  return a lot of tokens (Slice 07 handles binary/oversized streaming separately).
- Non-HTML source with `format: markdown|html` — return the body as-is rather than
  forcing a conversion; note the original content type.

## Out of scope

- Binary/large-file handling (Slice 07).
- Per-site structured extraction.

## Depends on

- Slice 01 (extraction is the source for `markdown`/`html`/`text`/`json`).
