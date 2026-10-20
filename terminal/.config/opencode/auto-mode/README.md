# OpenCode auto mode

A local permission plugin for OpenCode **1.18.34**. Routine repository reads get
one-time approval; ambiguous permission requests go to a separate model which
chooses **allow**, **ask the user**, or **deny**.

## How it works

1. OpenCode evaluates its configured permissions. Existing `allow` and `deny`
   decisions are handled by OpenCode; this plugin receives pending `ask` requests.
2. A deterministic policy recognizes a small set of read-only Git operations in
   the current worktree, including configured remote names.
3. Other requests are reviewed using the full tool arguments, permission patterns
   and metadata, working directory, and up to three recent user messages from the
   last 20 session messages. Assistant claims of authorization are not included.
4. The plugin replies `once` for an approval or `reject` for a denial. An `ask`
   result leaves OpenCode's ordinary permission prompt available.

The model runs in a fresh, tool-less OpenCode session using your existing provider
authentication. The plugin installs a hidden `auto-mode-reviewer` agent, denies its
tools, blocks tool execution in reviewer sessions, and aborts/deletes those
temporary sessions afterward. Decisions are logged under the `auto-mode` service;
asks and denials also produce a TUI toast when notifications are enabled.

### Examples

| Operation | Treatment |
| --- | --- |
| `git status --short` | Fast approval inside the current repository |
| `git branch -r` | Fast approval |
| `git ls-remote --heads origin` | Fast approval if `origin` is a configured remote |
| `git log --oneline origin/main` | Fast approval |
| `git show origin/main:README.md` | Fast approval for the recognized blob-read syntax |
| `git diff --no-ext-diff --no-textconv main..origin/main` | Fast approval |
| `git fetch origin` | Model review: fetching writes local refs |
| `git push`, deployment, destructive commands | Model evaluates authorization and effects; unclear cases prompt |
| Shell chains, redirections, substitutions, `git -c`, or `git -C` | Model review of the complete operation |
| Missing context, invalid JSON, low confidence, timeout, provider error | User decides |
| Doom-loop and explicit user checkpoints | User decides |

Quotes and unfamiliar flags also go to the model. The fast path intentionally
recognizes a small command language rather than attempting to parse all of Bash.
Repository checks resolve symlinks and reject workdirs outside the active worktree
and nested repositories with a different root. URLs supplied directly to
`git ls-remote` are reviewed rather than fast-approved.

## Configuration

The plugin is enabled in the adjacent `opencode.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    ["./auto-mode/index.ts", {
      "model": "openai/gpt-6-astra",
      "timeoutMs": 20000,
      "minConfidence": 0.9,
      "maxConcurrentReviews": 2,
      "notify": true
    }]
  ]
}
```

Quit and restart OpenCode after changing configuration or plugin code.

| Option | Default | Meaning |
| --- | --- | --- |
| `enabled` | `true` | Set to `false` to disable the plugin and its injected defaults |
| `model` | `openai/gpt-6-astra` | Reviewer `provider/model` ID |
| `timeoutMs` | `20000` | Review deadline, from 100 to 120000 ms |
| `minConfidence` | `0.9` | Minimum model-reported confidence for both automatic allow and deny |
| `maxConcurrentReviews` | `2` | Additional concurrent requests stay with the user; range 1–10 |
| `notify` | `true` | Show ask/deny explanations as TUI toasts |

For a one-launch override:

```bash
OPENCODE_AUTO_MODE_MODEL=openai/gpt-6-astra opencode
OPENCODE_AUTO_MODE_DISABLED=1 opencode
```

The selected model was verified with this machine's ChatGPT/Codex authentication.
`openai/gpt-5.4-mini` and `openai/gpt-5.4` appeared in the model catalog but were
rejected by that authentication during live testing. Catalog availability alone
does not establish account access.

### Permission defaults and precedence

At startup the plugin supplies `ask` defaults for `bash`, `webfetch`, and each
configured MCP server's `<server>_*` tools. Existing user rules retain their order
and take precedence. Native file editing, reading, searching, and agent permission
policies otherwise govern those operations normally. Any permission request that
does reach the plugin can be reviewed, including file and external-directory asks.

To route additional operations through review, configure their permissions:

```jsonc
"permission": {
  "edit": "ask",
  "task": "ask"
}
```

Per-agent overrides and broad explicit `allow` rules can bypass review, just as
they bypass a normal permission prompt. Review applies to each actual request,
not to an entire tool category or delegated task. For hard exclusions, use native
`deny` rules. The plugin never replies `always` or writes learned wildcard grants
to disk; repeated ambiguous requests are reevaluated against current context.

## Runtime details

- This implementation uses `permission.asked` events and the supplied SDK client.
  OpenCode 1.18.34 declares `permission.ask` in its plugin types but its permission
  engine does not invoke that hook. Reusing the supplied client also supports the
  in-process TUI transport and server authentication.
- The permission prompt may appear briefly while the model reviews it. A user's
  reply cancels an in-flight review. Duplicate loading through dotfiles symlinks
  is deduplicated per OpenCode client.
- OpenCode's `reject` operation also rejects other pending permissions in the
  same session. This is native behavior, including for automatic denials.
- Requests exceeding 48,000 serialized characters go to the user rather than
  having potentially important command tails truncated.
- Review sends the included user messages and tool arguments to the configured
  model provider and incurs that model's normal usage. It does not send the whole
  repository or run inspection tools to resolve missing evidence.
- Model classification is probabilistic, and reported confidence is not calibrated
  proof of correctness. This is permission automation, not an OS sandbox. Fast
  Git rules assume trusted Git binaries and repository/user Git configuration.
- Compatibility is targeted at the tested 1.18.34 permission API, not the separate
  OpenCode 2 plugin API.

## Development

From this directory:

```bash
bun install
bun run typecheck
bun test
```

The runtime uses Node built-ins and OpenCode's supplied client; development SDK
imports are type-only. Tests cover command injection variants, repo and symlink
boundaries, output validation, rule ordering, tool isolation, cancellation,
timeouts (including uncooperative transports), concurrency, and duplicate loads.

Live verification on OpenCode 1.18.34 also confirmed that `git branch -r` completed
with a one-time approval and zero reviewer sessions, and
`git rev-parse --show-toplevel` completed with one reviewer session and one-time
approval using `openai/gpt-6-astra`.
