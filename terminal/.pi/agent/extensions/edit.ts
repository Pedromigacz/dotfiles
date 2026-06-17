/**
 * `edit` tool — explicit base (behaves exactly like default mode).
 *
 * The factory supplies the stock schema, execute logic, and renderer. The
 * prompt text the model sees (description / promptSnippet / promptGuidelines)
 * is re-stated explicitly below so it can be edited here. The values match
 * stock pi verbatim, so with no edits this is identical to default mode.
 *
 * Customise via EditToolOptions:
 *   - operations?: EditOperations Swap the filesystem backend used for edits.
 */

import { type ExtensionAPI, createEditToolDefinition } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  const edit = createEditToolDefinition(process.cwd());

  // --- Prompt text injected into the system prompt (edit freely) ---
  edit.description =
    "Edit a single file using exact text replacement. Every edits[].oldText must match a unique, non-overlapping region of the original file. If two changes affect the same block or nearby lines, merge them into one edit instead of emitting overlapping edits. Do not include large unchanged regions just to connect distant changes.";
  edit.promptSnippet =
    "Make precise file edits with exact text replacement, including multiple disjoint edits in one call";
  edit.promptGuidelines = [
    "Use edit for precise changes (edits[].oldText must match exactly)",
    "When changing multiple separate locations in one file, use one edit call with multiple entries in edits[] instead of multiple edit calls",
    "Each edits[].oldText is matched against the original file, not after earlier edits are applied. Do not emit overlapping or nested edits. Merge nearby changes into one edit.",
    "Keep edits[].oldText as small as possible while still being unique in the file. Do not pad with large unchanged regions.",
  ];

  pi.registerTool(edit);
}
