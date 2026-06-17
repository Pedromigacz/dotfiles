/**
 * `read` tool — explicit base (behaves exactly like default mode).
 *
 * The factory supplies the stock schema, execute logic, and renderer. The
 * prompt text the model sees (description / promptSnippet / promptGuidelines)
 * is re-stated explicitly below so it can be edited here. The values match
 * stock pi verbatim, so with no edits this is identical to default mode.
 *
 * Customise via ReadToolOptions:
 *   - autoResizeImages?: boolean  Auto-resize images to 2000x2000 max (default: true).
 *   - operations?: ReadOperations Swap the filesystem backend.
 */

import {
  type ExtensionAPI,
  createReadToolDefinition,
  DEFAULT_MAX_LINES,
  DEFAULT_MAX_BYTES,
} from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  const read = createReadToolDefinition(process.cwd(), {
    autoResizeImages: true,
  });

  // --- Prompt text injected into the system prompt (edit freely) ---
  read.description = `Read the contents of a file. Supports text files and images (jpg, png, gif, webp). Images are sent as attachments. For text files, output is truncated to ${DEFAULT_MAX_LINES} lines or ${DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first). Use offset/limit for large files. When you need the full file, continue with offset until complete.`;
  read.promptSnippet = "Read file contents";
  read.promptGuidelines = ["Use read to examine files instead of cat or sed."];

  pi.registerTool(read);
}
