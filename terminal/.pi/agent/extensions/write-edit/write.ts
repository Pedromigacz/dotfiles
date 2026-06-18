/**
 * `write` tool — explicit base (behaves exactly like default mode).
 *
 * The factory supplies the stock schema, execute logic, and renderer. The
 * prompt text the model sees (description / promptSnippet / promptGuidelines)
 * is re-stated explicitly below so it can be edited here. The values match
 * stock pi verbatim, so with no edits this is identical to default mode.
 *
 * Customise via WriteToolOptions:
 *   - operations?: WriteOperations Swap the filesystem backend used for writes.
 */

import { type ExtensionAPI, createWriteToolDefinition } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  const write = createWriteToolDefinition(process.cwd());

  // --- Prompt text injected into the system prompt (edit freely) ---
  write.description =
    "Write content to a file. Creates the file if it doesn't exist, overwrites if it does. Automatically creates parent directories.";
  write.promptSnippet = "Create or overwrite files";
  write.promptGuidelines = ["Use write only for new files or complete rewrites."];

  pi.registerTool(write);
}
