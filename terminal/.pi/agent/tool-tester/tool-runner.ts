/**
 * tool-runner — execution adapter for a single tool invocation.
 *
 * Pure of any UI or session concerns: it takes a tool-like object, synthesizes a
 * tool-call id, applies the tool's optional argument-preparation shim, invokes
 * `execute` with the abort signal and an update callback, times the call, and
 * captures a thrown error into an error-flagged result instead of propagating it.
 *
 * It depends only on the injected `RunnableTool` interface, so it can be tested
 * with a fake tool — no live session, no terminal.
 */

import type {
  AgentToolResult,
  AgentToolUpdateCallback,
} from "@earendil-works/pi-coding-agent";

/** Minimal subset of an agent tool that the runner needs to drive. */
export interface RunnableTool {
  name: string;
  /** Optional shim applied to raw params before `execute`. */
  prepareArguments?: (args: unknown) => unknown;
  execute: (
    toolCallId: string,
    params: any,
    signal?: AbortSignal,
    onUpdate?: AgentToolUpdateCallback,
  ) => Promise<AgentToolResult<unknown>>;
}

/** Outcome of a single run. `result` is always present, even on error. */
export interface ToolRunOutcome {
  /** The tool-call id synthesized for this run. */
  toolCallId: string;
  /** The tool result. On a thrown error, a synthesized error result. */
  result: AgentToolResult<unknown>;
  /** True when the tool threw. */
  isError: boolean;
  /** The thrown error, if any. */
  error?: Error;
  /** Wall-clock duration of the `execute` call, in milliseconds. */
  durationMs: number;
}

export interface RunToolOptions {
  /** Params passed to the tool. Defaults to an empty object. */
  params?: unknown;
  /** Abort signal forwarded to `execute`. */
  signal?: AbortSignal;
  /** Update callback forwarded to `execute` for streamed partials. */
  onUpdate?: AgentToolUpdateCallback;
  /** Override id synthesis (injectable for tests). */
  makeToolCallId?: (toolName: string) => string;
  /** Override the clock (injectable for tests). */
  now?: () => number;
}

let callCounter = 0;

/** Synthesize a stable-ish unique tool-call id for a run. */
function defaultToolCallId(toolName: string): string {
  callCounter += 1;
  return `tooltester-${toolName}-${callCounter}`;
}

/**
 * Run a tool once and capture its outcome.
 *
 * Never throws for tool failures: a thrown error is converted into an
 * error-flagged outcome whose `result` carries the error message as text.
 */
export async function runTool(
  tool: RunnableTool,
  options: RunToolOptions = {},
): Promise<ToolRunOutcome> {
  const now = options.now ?? (() => performance.now());
  const makeId = options.makeToolCallId ?? defaultToolCallId;
  const toolCallId = makeId(tool.name);

  const rawParams = options.params ?? {};
  const params = tool.prepareArguments
    ? tool.prepareArguments(rawParams)
    : rawParams;

  const start = now();
  try {
    const result = await tool.execute(
      toolCallId,
      params,
      options.signal,
      options.onUpdate,
    );
    return {
      toolCallId,
      result,
      isError: false,
      durationMs: now() - start,
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return {
      toolCallId,
      result: {
        content: [{ type: "text", text: error.message }],
        details: {},
      },
      isError: true,
      error,
      durationMs: now() - start,
    };
  }
}
