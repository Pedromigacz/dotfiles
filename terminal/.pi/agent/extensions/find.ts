/**
 * `find` tool — explicit base (behaves exactly like default mode).
 *
 * The factory supplies the stock schema, execute logic, and renderer. The
 * prompt text the model sees (description / promptSnippet / promptGuidelines)
 * is re-stated explicitly below so it can be edited here. The values match
 * stock pi verbatim, so with no edits this is identical to default mode.
 *
 * Default-active parity: in stock pi, `find` is NOT in the default active set
 * (read/bash/edit/write) — it ships off and is toggled on via /tools. The
 * runtime auto-activates every extension-registered tool at startup, so we turn
 * `find` back off on a fresh start. It stays enableable via /tools within a
 * session; a reload preserves the current toggle.
 *
 * Customise via FindToolOptions:
 *   - operations?: FindOperations Swap the backend (default: local fs + fd).
 */

import {
  type ExtensionAPI,
  createFindToolDefinition,
  DEFAULT_MAX_BYTES,
} from "@earendil-works/pi-coding-agent";

const TOOL_NAME = "find";
const DEFAULT_LIMIT = 1000; // max results before truncation (stock value)

export default function (pi: ExtensionAPI) {
  const find = createFindToolDefinition(process.cwd());

  // --- Prompt text injected into the system prompt (edit freely) ---
  find.description = `Search for files by glob pattern. Returns matching file paths relative to the search directory. Respects .gitignore. Output is truncated to ${DEFAULT_LIMIT} results or ${DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first).`;
  find.promptSnippet = "Find files by glob pattern (respects .gitignore)";
  find.promptGuidelines = []; // stock: none — add tool-specific bullets here

  pi.registerTool(find);

  pi.on("session_start", (event) => {
    if (event.reason !== "reload") {
      pi.setActiveTools(pi.getActiveTools().filter((name) => name !== TOOL_NAME));
    }
  });
}
