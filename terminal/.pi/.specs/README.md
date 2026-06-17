# web_fetch smart-fetch port — vertical slices

Port the capabilities of [`pi-smart-fetch`](https://github.com/Thinkscape/agent-smart-fetch/tree/main/packages/pi-smart-fetch)
into our local pi extension at `terminal/.pi/agent/extensions/web-fetch.ts`.

Each file below is a **vertical slice**: a thin, end-to-end increment that is
independently shippable and testable on its own. They are ordered by dependency,
but each one leaves the extension in a working, releasable state.

## Slices

| # | Slice | New deps | Depends on |
|---|---|---|---|
| 01 | [Readable content extraction](./01-readable-content-extraction.md) | `defuddle`, `linkedom` | — |
| 02 | [Output format selection](./02-output-formats.md) | — | 01 |
| 03 | [Configurable defaults from pi settings](./03-configurable-defaults.md) | — | — |
| 04 | [Browser TLS fingerprinting](./04-browser-tls-fingerprinting.md) | `wreq-js` | — |
| 05 | [Batch fetch tool](./05-batch-fetch.md) | — | 01 |
| 06 | [Meta-refresh & alternate-content following](./06-redirect-following.md) | — | 01, 02 |
| 07 | [Binary & large-file downloads](./07-binary-downloads.md) | — | — |
| 08 | [Rich TUI rendering & progress](./08-tui-rendering.md) | — | 01 |

## Shared context

- **Target file:** `terminal/.pi/agent/extensions/web-fetch.ts` (single-file extension,
  auto-loaded from the agent config dir). May be split into a small folder of modules
  if it grows — pi loads `.ts`/`.js` from the `extensions/` directory.
- **Runtime model:** pi loads extensions through `jiti`, resolving imports from
  `terminal/.pi/agent/node_modules`. pi bundles only its core packages
  (`@earendil-works/*`, `typebox`); **any third-party dep must be added to
  `dependencies` in `terminal/.pi/agent/package.json` and installed with `bun install`**
  so it resolves at runtime, not just for the editor.
- **Tool result contract:** `execute` returns `{ content, details }` (both required);
  signal failures by **throwing** — the runtime surfaces a thrown error as `isError=true`.
  The `onUpdate` progress callback also requires `{ content, details }`.
- **Reference implementation:** the upstream package's fetch engine lives in a
  separate `smart-fetch-core` module; only its pi-integration layer (`src/index.ts`,
  `src/settings.ts`) is public. We are re-implementing the engine, not vendoring it.

## Definition of done (whole epic)

All eight slices merged; `bunx tsc --noEmit -p terminal/.pi/agent/tsconfig.json` is
clean; the extension loads in a real pi session and `web_fetch` / `batch_web_fetch`
behave per each slice's acceptance criteria.
