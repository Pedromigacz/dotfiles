import { describe, expect, test } from "bun:test";

import { formatResult, type FormatResultInput } from "./result-format";

function input(overrides: Partial<FormatResultInput> = {}): FormatResultInput {
  return {
    content: [{ type: "text", text: "hello" }],
    details: {},
    isError: false,
    durationMs: 42,
    ...overrides,
  };
}

describe("formatResult", () => {
  test("renders plain text content as a markdown segment", () => {
    const model = formatResult(
      input({ content: [{ type: "text", text: "# Title\n\nbody" }] }),
    );

    expect(model.content).toEqual([{ kind: "markdown", text: "# Title\n\nbody" }]);
    expect(model.isError).toBe(false);
    expect(model.errorBanner).toBeUndefined();
  });

  test("reports a duration line", () => {
    expect(formatResult(input({ durationMs: 42 })).durationLabel).toBe("42ms");
    expect(formatResult(input({ durationMs: 1500 })).durationLabel).toBe("1.5s");
    expect(formatResult(input({ durationMs: 42 })).durationMs).toBe(42);
  });

  test("omits details when there is nothing to show", () => {
    expect(formatResult(input({ details: {} })).details).toBeUndefined();
    expect(formatResult(input({ details: null })).details).toBeUndefined();
    expect(formatResult(input({ details: undefined })).details).toBeUndefined();
  });

  test("includes pretty JSON details with a collapsed summary", () => {
    const model = formatResult(
      input({ details: { path: "/tmp/x", lines: 3 } }),
    );

    expect(model.details?.json).toBe(
      '{\n  "path": "/tmp/x",\n  "lines": 3\n}',
    );
    expect(model.details?.summary).toBe("{…} (2 keys)");
  });

  test("summarizes array details by length", () => {
    const model = formatResult(input({ details: [1, 2, 3] }));
    expect(model.details?.summary).toBe("[…] (3 items)");
    expect(model.details?.json).toBe("[\n  1,\n  2,\n  3\n]");
  });

  test("text plus details surfaces both", () => {
    const model = formatResult(
      input({
        content: [{ type: "text", text: "result body" }],
        details: { ok: true },
      }),
    );

    expect(model.content).toEqual([{ kind: "markdown", text: "result body" }]);
    expect(model.details?.json).toBe('{\n  "ok": true\n}');
  });

  test("an error-flagged result carries a banner from the thrown error", () => {
    const model = formatResult(
      input({
        isError: true,
        error: new Error("boom"),
        content: [{ type: "text", text: "boom" }],
      }),
    );

    expect(model.isError).toBe(true);
    expect(model.errorBanner).toBe("boom");
  });

  test("error banner falls back to first text content, then a generic message", () => {
    const fromText = formatResult(
      input({ isError: true, content: [{ type: "text", text: "failed here" }] }),
    );
    expect(fromText.errorBanner).toBe("failed here");

    const generic = formatResult(input({ isError: true, content: [] }));
    expect(generic.errorBanner).toBe("Tool returned an error.");
  });

  test("an image block becomes a placeholder, not binary, and keeps order", () => {
    const model = formatResult(
      input({
        content: [
          { type: "text", text: "see image:" },
          { type: "image", data: "AAAA", mimeType: "image/png" },
        ],
        details: {},
      }),
    );

    expect(model.content[0]).toEqual({ kind: "markdown", text: "see image:" });
    const image = model.content[1];
    expect(image.kind).toBe("image");
    if (image.kind === "image") {
      expect(image.placeholder).toContain("image/png");
      expect(image.placeholder).not.toContain("AAAA");
    }
  });
});
