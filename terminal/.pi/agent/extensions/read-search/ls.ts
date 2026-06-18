/**
 * `ls` tool — explicit base (behaves exactly like default mode).
 *
 * The factory supplies the stock schema, execute logic, and renderer. The
 * prompt text the model sees (description / promptSnippet / promptGuidelines)
 * is re-stated explicitly below so it can be edited here. The values match
 * stock pi verbatim, so with no edits this is identical to default mode.
 *
 * Default-active parity: in stock pi, `ls` is NOT in the default active set
 * (read/bash/edit/write) — it ships off and is toggled on via /tools. The
 * runtime auto-activates every extension-registered tool at startup, so we turn
 * `ls` back off on a fresh start. It stays enableable via /tools within a
 * session; a reload preserves the current toggle.
 *
 * Customise via LsToolOptions:
 *   - operations?: LsOperations Swap the directory-listing backend (default: local fs).
 */

import {
  type ExtensionAPI,
  createLsToolDefinition,
  DEFAULT_MAX_BYTES,
} from "@earendil-works/pi-coding-agent";

const TOOL_NAME = "ls";
const DEFAULT_LIMIT = 500; // max entries before truncation (stock value)

export default function (pi: ExtensionAPI) {
  const ls = createLsToolDefinition(process.cwd());

  // --- Prompt text injected into the system prompt (edit freely) ---
  ls.description = `List directory contents. Returns entries sorted alphabetically, with '/' suffix for directories. Includes dotfiles. Output is truncated to ${DEFAULT_LIMIT} entries or ${DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first).`;
  ls.promptSnippet = "List directory contents";
  ls.promptGuidelines = []; // stock: none — add tool-specific bullets here

  pi.registerTool(ls);

  pi.on("session_start", (event) => {
    if (event.reason !== "reload") {
      pi.setActiveTools(pi.getActiveTools().filter((name) => name !== TOOL_NAME));
    }
  });
}
