import {
  type ExtensionAPI,
  createFindToolDefinition,
  DEFAULT_MAX_BYTES,
} from "@earendil-works/pi-coding-agent";

const TOOL_NAME = "find";
const DEFAULT_LIMIT = 1000; // max results before truncation (stock value)

export default function (pi: ExtensionAPI) {
  const find = createFindToolDefinition(process.cwd());

  find.description = `Search for files by glob pattern. Returns matching file paths relative to the search directory. Respects .gitignore. Output is truncated to ${DEFAULT_LIMIT} results or ${DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first).`;
  find.promptSnippet = "Find files by glob pattern (respects .gitignore)";
  find.promptGuidelines = []; // stock: none — add tool-specific bullets here

  pi.registerTool(find);

  pi.on("session_start", (event) => {
    if (event.reason !== "reload") {
      pi.setActiveTools(
        pi.getActiveTools().filter((name) => name !== TOOL_NAME),
      );
    }
  });
}
