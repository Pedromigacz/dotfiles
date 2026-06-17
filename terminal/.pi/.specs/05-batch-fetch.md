# Slice 05 — Batch fetch tool

## Value

Research and comparison tasks often need several pages at once. Forcing the agent to
call `web_fetch` serially is slow and clutters the turn. A batch tool fetches many
URLs concurrently in a single call, with a concurrency bound so we don't hammer hosts
or exhaust resources.

## Outcome

A new `batch_web_fetch` tool accepts a list of requests (each with the same options as
`web_fetch`) and returns per-URL results, running them with bounded concurrency.

## Scope

- Register a second tool, `batch_web_fetch`, taking a `requests` array where each item
  accepts the same parameters as `web_fetch`.
- Run requests concurrently up to a configurable concurrency limit (default from
  Slice 03 settings).
- Return a per-item result set: each item reports success with content/metadata or a
  failure with an error message, plus an overall summary (total / succeeded / failed).
- Reuse the single-fetch execution path so every per-item fetch honors all options
  (format, fingerprint, timeout, etc.).

## Acceptance criteria

- Fetching N URLs in one call returns N results, each independently success or error.
- No more than the configured number of requests are in flight at once.
- A failure on one URL does not abort the others; it is reported as that item's error.
- The default concurrency is read from settings and overridable per call.
- The summary counts (total/succeeded/failed) match the per-item results.

## Edge cases

- Empty `requests` array — return an empty result set with a zero summary, not an error.
- Duplicate URLs — fetched independently (no dedup expected).
- A very large list — concurrency bound still holds; consider a sane upper limit on
  list size and document it if added.

## Out of scope

- Cross-request deduplication or caching.
- Per-item live progress rendering (Slice 08 covers TUI; this slice only needs correct
  results and a final summary).

## Depends on

- Slice 01 (per-item extraction). Benefits from 02/03/04 but should reuse whatever the
  single-fetch path supports at merge time.
