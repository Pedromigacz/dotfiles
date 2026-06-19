import { describe, expect, test } from "bun:test";

import { runTool, type RunnableTool } from "./tool-runner";

function okTool(overrides: Partial<RunnableTool> = {}): RunnableTool {
  return {
    name: "fake",
    execute: async () => ({
      content: [{ type: "text", text: "hello" }],
      details: { ok: true },
    }),
    ...overrides,
  };
}

describe("runTool", () => {
  test("synthesizes a tool-call id and passes it to execute", async () => {
    let seen: string | undefined;
    const tool = okTool({
      execute: async (id) => {
        seen = id;
        return { content: [], details: {} };
      },
    });

    const outcome = await runTool(tool, {
      makeToolCallId: (name) => `id-${name}`,
    });

    expect(outcome.toolCallId).toBe("id-fake");
    expect(seen).toBe("id-fake");
  });

  test("default id synthesis is non-empty and includes the tool name", async () => {
    const outcome = await runTool(okTool());
    expect(outcome.toolCallId).toContain("fake");
    expect(outcome.toolCallId.length).toBeGreaterThan(0);
  });

  test("applies the preparation shim before execute", async () => {
    let received: unknown;
    const tool = okTool({
      prepareArguments: (args) => ({ wrapped: args }),
      execute: async (_id, params) => {
        received = params;
        return { content: [], details: {} };
      },
    });

    await runTool(tool, { params: { a: 1 } });

    expect(received).toEqual({ wrapped: { a: 1 } });
  });

  test("forwards params unchanged when no shim is present", async () => {
    let received: unknown;
    const tool = okTool({
      execute: async (_id, params) => {
        received = params;
        return { content: [], details: {} };
      },
    });

    await runTool(tool, { params: { a: 1 } });

    expect(received).toEqual({ a: 1 });
  });

  test("forwards the abort signal and update callback", async () => {
    const controller = new AbortController();
    let signal: AbortSignal | undefined;
    let update: unknown;
    const tool = okTool({
      execute: async (_id, _params, sig, onUpdate) => {
        signal = sig;
        onUpdate?.({ content: [], details: {} });
        return { content: [], details: {} };
      },
    });

    const updates: unknown[] = [];
    await runTool(tool, {
      signal: controller.signal,
      onUpdate: (p) => updates.push(p),
    });

    expect(signal).toBe(controller.signal);
    expect(updates.length).toBe(1);
  });

  test("reports timing from the injected clock", async () => {
    let t = 100;
    const tool = okTool({
      execute: async () => {
        t = 142;
        return { content: [], details: {} };
      },
    });

    const outcome = await runTool(tool, { now: () => t });

    expect(outcome.durationMs).toBe(42);
  });

  test("converts a thrown error into an error-flagged result", async () => {
    const tool = okTool({
      execute: async () => {
        throw new Error("boom");
      },
    });

    const outcome = await runTool(tool);

    expect(outcome.isError).toBe(true);
    expect(outcome.error?.message).toBe("boom");
    expect(outcome.result.content[0]).toEqual({ type: "text", text: "boom" });
  });

  test("normalizes a non-Error throw", async () => {
    const tool = okTool({
      execute: async () => {
        throw "nope";
      },
    });

    const outcome = await runTool(tool);

    expect(outcome.isError).toBe(true);
    expect(outcome.error?.message).toBe("nope");
  });

  test("a successful run is not flagged as an error", async () => {
    const outcome = await runTool(okTool());
    expect(outcome.isError).toBe(false);
    expect(outcome.error).toBeUndefined();
    expect(outcome.result.details).toEqual({ ok: true });
  });
});
