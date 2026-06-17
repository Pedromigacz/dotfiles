/**
 * `grep` tool — explicit base (behaves exactly like default mode).
 *
 * The factory supplies the stock schema, execute logic, and renderer. The
 * prompt text the model sees (description / promptSnippet / promptGuidelines)
 * is re-stated explicitly below so it can be edited here. The values match
 * stock pi verbatim, so with no edits this is identical to default mode.
 *
 * Default-active parity: in stock pi, `grep` is NOT in the default active set
 * (read/bash/edit/write) — it ships off and is toggled on via /tools. The
 * runtime auto-activates every extension-registered tool at startup, so we turn
 * `grep` back off on a fresh start. It stays enableable via /tools within a
 * session; a reload preserves the current toggle.
 *
 * Customise via GrepToolOptions:
 *   - operations?: GrepOperations Swap the backend (default: local fs + ripgrep).
 */

import {
  type ExtensionAPI,
  createGrepToolDefinition,
  DEFAULT_MAX_BYTES,
} from "@earendil-works/pi-coding-agent";

const TOOL_NAME = "grep";
const DEFAULT_LIMIT = 100; // max matches before truncation (stock value)
const MAX_LINE_LENGTH = 500; // max chars per match line (stock value)

export default function (pi: ExtensionAPI) {
  const grep = createGrepToolDefinition(process.cwd());

  // --- Prompt text injected into the system prompt (edit freely) ---
  grep.description = `Search file contents for a pattern. Returns matching lines with file paths and line numbers. Respects .gitignore. Output is truncated to ${DEFAULT_LIMIT} matches or ${DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first). Long lines are truncated to ${MAX_LINE_LENGTH} chars.`;
  grep.promptSnippet = "Search file contents for patterns (respects .gitignore)";
  grep.promptGuidelines = []; // stock: none — add tool-specific bullets here

  pi.registerTool(grep);

  pi.on("session_start", (event) => {
    if (event.reason !== "reload") {
      pi.setActiveTools(pi.getActiveTools().filter((name) => name !== TOOL_NAME));
    }
  });
}
