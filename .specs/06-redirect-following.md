# Slice 06 — Meta-refresh & alternate-content following

## Value

Some pages don't return their real content directly: they serve an HTML shell that
client-side redirects via `<meta http-equiv="refresh">`, or they advertise a cleaner
machine-readable version (markdown/JSON/plain) through `<link rel="alternate">`. HTTP
redirects are already followed by the fetch layer, but these client-side hints are not
— so the agent gets an empty shell instead of the content. Following them recovers
real content the current tool misses.

## Outcome

When a fetched HTML page is a redirect shell or advertises an alternate representation
matching the requested format, `web_fetch` follows the hint (within strict loop limits)
and returns the real/better content.

## Scope

- Detect and follow `<meta http-equiv="refresh" content="...url=...">` redirects.
- When extraction yields no/thin content, detect qualifying
  `<link rel="alternate" type="...">` entries in `<head>` whose media type matches the
  requested `format` (e.g. `text/markdown`, `text/plain`, `application/json`) and fetch
  that instead.
- Enforce a maximum hop count and detect/break redirect loops.
- Record the final resolved URL in the result metadata and `details`.

## Acceptance criteria

- A page that only sets a `<meta refresh>` to another URL resolves to that URL's
  content, not the shell.
- When primary extraction is empty and a matching `<link rel=alternate>` exists, the
  alternate is fetched and returned.
- Redirect chains stop at the configured hop limit and loops are broken without
  hanging or throwing.
- The result reports the final URL actually used.
- Alternate-following only triggers on empty/thin content, not on pages that already
  extracted cleanly.

## Edge cases

- `<meta refresh>` with a delay (e.g. `content="5;url=..."`) — follow only sane
  immediate-ish redirects; document the threshold chosen.
- Multiple `<link rel=alternate>` candidates — pick the best match for the requested
  format; define the tie-break.
- Alternate URL itself redirects — counts against the same hop budget.

## Out of scope

- Server-side / HTTP `3xx` redirects (already handled by the fetch layer).
- Executing JavaScript-based redirects.

## Depends on

- Slice 01 (knowing content is "thin" requires extraction) and Slice 02 (matching the
  alternate's media type to the requested format).
