/**
 * `bash` tool — explicit base (behaves exactly like default mode).
 *
 * The factory supplies the stock schema, execute logic, and renderer. The
 * prompt text the model sees (description / promptSnippet / promptGuidelines)
 * is re-stated explicitly below so it can be edited here. The values match
 * stock pi verbatim, so with no edits this is identical to default mode.
 *
 * Customise via BashToolOptions:
 *   - commandPrefix?: string      Prepended to every command (shell setup, etc.).
 *   - shellPath?: string          Explicit shell binary (default: system shell).
 *   - spawnHook?: BashSpawnHook   Adjust command / cwd / env before execution.
 *   - operations?: BashOperations Swap the command-execution backend.
 */

import {
  type ExtensionAPI,
  createBashToolDefinition,
  DEFAULT_MAX_LINES,
  DEFAULT_MAX_BYTES,
} from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  const bash = createBashToolDefinition(process.cwd(), {
    // commandPrefix: undefined,
    // shellPath: undefined,
    // spawnHook: (ctx) => ctx,
  });

  // --- Prompt text injected into the system prompt (edit freely) ---
  bash.description = `Execute a bash command in the current working directory. Returns stdout and stderr. Output is truncated to last ${DEFAULT_MAX_LINES} lines or ${DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first). If truncated, full output is saved to a temp file. Optionally provide a timeout in seconds.`;
  bash.promptSnippet = "Execute bash commands (ls, grep, find, etc.)";
  bash.promptGuidelines = []; // stock: none — add tool-specific bullets here

  pi.registerTool(bash);
}
