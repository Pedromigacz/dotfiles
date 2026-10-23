# OpenCode auto mode

A selectable `automode` primary agent and local permission-review plugin for
OpenCode V2 (SDK pinned to 2.1.2).

## Usage

After changing the plugin, restart the background service with
`opencode service restart`, reopen OpenCode, and select **automode**.
The agent is declared in the adjacent `opencode.jsonc`. Its coding model is your
selected model; the plugin's `model` option controls only permission review.

## How it works

- V2's `permission.evaluate` hook reviews only `ask` decisions attributed to
  automode tool calls. Existing allows and configured denies retain their behavior.
- Full tool inputs are captured through V2 tool hooks. Resumed calls recover inputs
  from the issuing assistant message, checking its agent and call ID.
- A small deterministic policy approves recognized read-only Git commands within
  the current repository. Quotes, chains, substitutions, unfamiliar flags, writes,
  and unrecognized commands go to the model reviewer.
- Review includes tool inputs, permission resources, metadata, working directory,
  and up to three user messages from the last 20 context messages.
- `generate.text` uses the configured provider authentication without tools,
  temporary sessions, or a hidden reviewer agent.
- Approval affects the current evaluation only. No persistent grants are written.
  Denials apply to the evaluated action; asks use the native permission prompt
  with the reviewer's explanation.
- Missing evidence, errors, invalid JSON, low confidence, concurrency overflow,
  and timeouts leave the decision to the user. Explicit human checkpoints remain
  manual. Plugin cleanup cancels pending reviews.

## Configuration

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [{
    "package": "./auto-mode",
    "options": {
      "model": "openai/gpt-6-astra",
      "timeoutMs": 20000,
      "minConfidence": 0.9,
      "maxConcurrentReviews": 2,
      "notify": true
    }
  }]
}
```

`enabled: false` disables automatic review. The configured agent remains available
with ordinary permission prompts. `OPENCODE_AUTO_MODE_DISABLED=1` and
`OPENCODE_AUTO_MODE_MODEL=provider/model` override settings in the **server's**
environment. Changing a terminal's environment does not change an already-running
shared service.

`notify` enables decision logging in the server log. V1 TUI toast calls were removed;
ask/deny explanations are now carried by native permission evaluation messages.
The timeout range is 100–120000 ms; concurrency is 1–10; confidence is 0–1.
Model references may include `#variant`.

The adjacent configuration asks for shell, webfetch, and AWS MCP operations under
automode. Add other review rules using native V2 agent permissions, for example:

```jsonc
"agents": {
  "automode": {
    "permissions": [
      { "action": "edit", "resource": "*", "effect": "ask" }
    ]
  }
}
```

Build, Plan, and delegated agents retain their own permission handling. Explicit
allows bypass automatic review; use configured denies for hard exclusions.
Evidence over 48,000 serialized characters is escalated, never truncated.
Review sends evidence to the selected model and incurs its normal usage.
Classification is probabilistic; fast Git rules assume trusted Git binaries and
repository/user Git configuration.

## Development

```sh
bun install
bun run typecheck
bun test
```

Tests cover Git command injection and repository boundaries, decision validation,
V2 agent isolation, resumed-call attribution, error fallback, cancellation,
timeouts, and concurrency limits.
