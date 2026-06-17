# Slice 01 — Readable content extraction

## Value

The agent currently gets HTML run through a crude regex stripper that keeps nav,
sidebars, cookie banners, and share widgets, and exposes no page metadata. Replace
that with a Readability-style extractor so `web_fetch` returns clean article content
plus useful metadata — the single biggest quality jump in the whole port.

## Outcome

When `web_fetch` retrieves an HTML page, it returns the main article content with
page chrome removed, alongside structured metadata (title, author, site name,
published date, language) when the page provides it.

## Scope

- Add `defuddle` + `linkedom` as runtime dependencies in
  `terminal/.pi/agent/package.json` (`dependencies`, not `devDependencies`) and
  `bun install` so they resolve under pi's `jiti` loader.
- Parse HTML responses with `linkedom`, run `defuddle` to extract main content and
  metadata, and emit that instead of the hand-rolled `htmlToText` output.
- Surface metadata in both the model-facing text (a short header) and the tool
  `details` object.
- Keep the existing crude converter only as a fallback for when extraction yields
  empty/very thin content.

## Acceptance criteria

- Fetching a typical article page (e.g. a blog post or news article) returns body
  text with no visible nav/footer/sidebar/share boilerplate.
- The result includes `title` and, when present on the page, `author`, `site`,
  `published`, and `lang`.
- Non-HTML responses (JSON, plain text) are unaffected and pass through as today.
- When extraction produces empty or near-empty content, the tool falls back to the
  existing converter rather than returning nothing.
- `bunx tsc --noEmit` is clean and the extension loads in a live pi session with the
  new deps resolving at runtime (not just in the editor).

## Edge cases

- Pages that are a thin HTML shell with content loaded by JS — extraction will be
  thin; fallback applies (full JS rendering is explicitly out of scope).
- Malformed HTML — `linkedom` should tolerate it; verify no unhandled throw.
- Very large documents — respect the existing `max_length` cap after extraction.

## Out of scope

- Output format options beyond the current behavior (Slice 02).
- JavaScript execution / headless browsing.
- Site-specific extractors (YouTube/Reddit/etc.) beyond what defuddle does natively.

## Technical notes

- Risk to verify early: confirm pi's runtime resolves third-party deps from
  `terminal/.pi/agent/node_modules`. If a locally auto-loaded extension does **not**
  get its `node_modules` on the resolver path, document the install/bundling step
  needed (this gates every dep-adding slice: 04).
