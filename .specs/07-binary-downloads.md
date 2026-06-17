# Slice 07 — Binary & large-file downloads

## Value

Pointing `web_fetch` at a PDF, image, archive, or other binary currently means dumping
raw bytes into the model's context — useless and expensive, and potentially huge. The
agent should instead be told "this is a 4 MB PDF saved at /tmp/...", so it can hand the
file to another tool or decide what to do, without blowing up the conversation.

## Outcome

When a response is binary or exceeds a size threshold, `web_fetch` streams it to a
temp file and returns a file descriptor (path, size, MIME type) instead of inlining the
content.

## Scope

- Detect binary / non-text responses (by content type and/or size threshold).
- Stream such responses to a file under a configurable temp directory (default from
  Slice 03 settings; fall back to the OS temp dir).
- Return a result describing the saved file — path, byte size, MIME type — rather than
  the bytes.
- Keep text/HTML responses on the normal extraction path unchanged.

## Acceptance criteria

- Fetching a PDF (or other binary) saves a file and returns its path, size, and MIME
  type; no raw binary is placed in the tool content.
- A response over the size threshold is streamed to disk even if it is text-typed.
- The temp directory is configurable and is created if missing.
- Normal HTML/JSON/text fetches are unaffected.
- The saved path is absolute and reported clearly enough for a follow-up tool to open it.

## Edge cases

- Unknown/missing content-type — fall back to size-based decision.
- Temp directory not writable — return a clear error (thrown) rather than corrupting
  the result.
- Concurrent batch downloads (Slice 05) writing many files — ensure unique filenames.

## Out of scope

- Parsing or extracting text from the downloaded binary (e.g. PDF → text).
- Automatic cleanup/retention policy for the temp directory (note it as a follow-up).

## Technical notes

- Independent of extraction; can land before or after most slices, but should compose
  with Slice 05 (each batch item may produce a file) when both are present.
