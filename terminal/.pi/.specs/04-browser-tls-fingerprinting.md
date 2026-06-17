# Slice 04 — Browser TLS fingerprinting

## Value

Node's built-in `fetch` is trivially identified and blocked by bot-defense layers
(Cloudflare, Akamai, PerimeterX). Many pages the agent is asked to read simply return
403/challenge pages. Impersonating a real desktop browser's TLS/HTTP2 fingerprint
gets clean responses from a large class of sites that currently fail.

## Outcome

`web_fetch` issues requests using a browser-like TLS/HTTP2 fingerprint, with optional
`browser` and `os` parameters to pick the impersonation profile, succeeding on many
bot-defended pages that the default fetch cannot retrieve.

## Scope

- Add `wreq-js` as a runtime dependency and route the HTTP request through it instead
  of (or as the default over) global `fetch`.
- Add optional `browser` and `os` parameters (e.g. a Chrome profile on Windows by
  default), resolvable from settings (Slice 03).
- Preserve existing behavior: timeout, abort-signal cancellation, redirect following,
  and header overrides.
- Allow an optional `proxy` parameter to route requests through a proxy.

## Acceptance criteria

- A page that returns a bot challenge to plain Node `fetch` returns real content via
  `web_fetch`.
- `browser` and `os` parameters select different fingerprint profiles; an invalid
  value falls back to the default profile rather than throwing.
- Per-request timeout and Esc/abort cancellation still work through the new client.
- Default profile is configurable via Slice 03 settings.
- The dependency resolves at runtime under pi's loader (see Slice 01 risk note).

## Edge cases

- `wreq-js` install/runtime portability across the user's machines (Linux/Node 25) —
  verify it loads; document any native/build requirement.
- Sites that still challenge despite fingerprinting — return a clear error; do not
  attempt to solve interactive/JS challenges.
- Custom `headers` must merge with, not clobber, the fingerprint's header set.

## Out of scope

- CAPTCHA solving, JS execution, or login automation.
- Rotating fingerprints / retry-on-block strategies (could be a later enhancement).

## Technical notes

- This is the heaviest dependency in the port. Verify load and basic request before
  wiring all parameters. If `wreq-js` proves unportable, the fallback is keeping
  global `fetch` with a realistic static `User-Agent` (records that as a degraded mode).
