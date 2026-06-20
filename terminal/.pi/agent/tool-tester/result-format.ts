/**
 * result-format — pure transform from a tool result into a display model.
 *
 * Takes a tool result (`content[]`, `details`, `isError`) plus run timing and
 * produces a structured display model the result view can render without further
 * decisions: markdown for text content, an ordered list of content segments with
 * placeholders for image blocks (so binary never reaches the screen), a duration
 * line, an error-banner flag, and pretty-printed details with a collapsed
 * summary.
 *
 * Pure and UI-free: no terminal, no ANSI, no pi-tui. The result view consumes
 * the model and applies styling, so this module is testable with plain inputs.
 */

import type { ImageContent, TextContent } from "@earendil-works/pi-ai";

/** One renderable piece of a tool result's content, in source order. */
export type ResultSegment =
  | { kind: "markdown"; text: string }
  | { kind: "image"; placeholder: string };

/** Pretty-printed `details` plus a one-line collapsed summary. */
export interface DetailsView {
  /** Pretty (2-space) JSON of the details value. */
  json: string;
  /** Single-line summary shown when the details are collapsed. */
  summary: string;
}

/** Everything the result view needs to render a single run's outcome. */
export interface ResultDisplayModel {
  /** True when the result was flagged as an error. */
  isError: boolean;
  /** Raw run duration in milliseconds. */
  durationMs: number;
  /** Human-readable duration, e.g. `"142ms"` or `"1.4s"`. */
  durationLabel: string;
  /** Banner text, present only when `isError`. */
  errorBanner?: string;
  /** Ordered content segments: markdown text and image placeholders. */
  content: ResultSegment[];
  /** Pretty details, omitted when there is nothing meaningful to show. */
  details?: DetailsView;
}

/** Structural input — a tool result plus timing. UI-agnostic on purpose. */
export interface FormatResultInput {
  /** Tool result content blocks, in order. */
  content: readonly (TextContent | ImageContent)[];
  /** Tool result structured details. */
  details: unknown;
  /** Whether the run was flagged as an error. */
  isError: boolean;
  /** Wall-clock duration of the run, in milliseconds. */
  durationMs: number;
  /** Thrown error, if the run failed by throwing. */
  error?: Error;
}

/** Format a wall-clock millisecond duration as a short human-readable label. */
function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
}

/** Approximate decoded byte size of a base64 payload, formatted for humans. */
function formatBytes(base64: string): string {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const bytes = Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** A placeholder/metadata line for an image block — never its binary data. */
function imagePlaceholder(block: ImageContent): string {
  const type = block.mimeType || "image";
  const size = block.data ? `, ~${formatBytes(block.data)}` : "";
  return `[image: ${type}${size}]`;
}

/** Pretty-print an arbitrary value as JSON, tolerating non-serializable input. */
function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

/** True when `details` carries something worth showing. */
function hasDetails(details: unknown): boolean {
  if (details === undefined || details === null) return false;
  if (typeof details === "object") return Object.keys(details).length > 0;
  return true;
}

/** A short, single-line summary of a details value for the collapsed view. */
function summarizeDetails(details: unknown): string {
  if (Array.isArray(details)) {
    return `[…] (${details.length} item${details.length === 1 ? "" : "s"})`;
  }
  if (typeof details === "object" && details !== null) {
    const keys = Object.keys(details);
    return `{…} (${keys.length} key${keys.length === 1 ? "" : "s"})`;
  }
  return prettyJson(details);
}

/** First text content block's text, if any — used as an error-banner fallback. */
function firstText(
  content: readonly (TextContent | ImageContent)[],
): string | undefined {
  for (const block of content) {
    if (block.type === "text" && block.text.trim().length > 0) return block.text;
  }
  return undefined;
}

/**
 * Transform a tool result plus timing into a display model.
 *
 * - Text blocks become markdown segments, image blocks become placeholder
 *   segments, preserving source order.
 * - When flagged as an error, `errorBanner` is populated from the thrown error,
 *   falling back to the first text block, then a generic message.
 * - `details` is included as pretty JSON with a collapsed summary only when it
 *   carries something; empty objects and nullish values are omitted.
 */
export function formatResult(input: FormatResultInput): ResultDisplayModel {
  const content: ResultSegment[] = input.content.map((block) =>
    block.type === "image"
      ? { kind: "image", placeholder: imagePlaceholder(block) }
      : { kind: "markdown", text: block.text },
  );

  const model: ResultDisplayModel = {
    isError: input.isError,
    durationMs: input.durationMs,
    durationLabel: formatDuration(input.durationMs),
    content,
  };

  if (input.isError) {
    model.errorBanner =
      input.error?.message ??
      firstText(input.content) ??
      "Tool returned an error.";
  }

  if (hasDetails(input.details)) {
    model.details = {
      json: prettyJson(input.details),
      summary: summarizeDetails(input.details),
    };
  }

  return model;
}
