import { describe, expect, test } from "bun:test";
import { Type } from "typebox";

import { validateParams } from "./validation";

const WEB_FETCH = Type.Object({
  url: Type.String({ description: "Absolute http(s) URL to fetch." }),
  max_length: Type.Optional(Type.Integer({ minimum: 1, default: 50000 })),
  raw: Type.Optional(Type.Boolean({ default: false })),
});

describe("validateParams", () => {
  test("coerces string widget values to their schema types", () => {
    const result = validateParams(WEB_FETCH, {
      url: "https://example.com",
      max_length: "10",
      raw: "true",
    });

    expect(result).toEqual({
      ok: true,
      params: { url: "https://example.com", max_length: 10, raw: true },
    });
  });

  test("applies schema defaults for omitted optional fields", () => {
    const result = validateParams(WEB_FETCH, { url: "https://example.com" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.params).toEqual({
        url: "https://example.com",
        max_length: 50000,
        raw: false,
      });
    }
  });

  test("treats an empty optional input as not provided (default applies)", () => {
    const result = validateParams(WEB_FETCH, {
      url: "https://example.com",
      max_length: "",
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.params.max_length).toBe(50000);
  });

  test("reports a missing required field", () => {
    const result = validateParams(WEB_FETCH, { url: "" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual({ key: "url", message: "required" });
    }
  });

  test("reports a wrong-type field scoped to its key", () => {
    const result = validateParams(WEB_FETCH, {
      url: "https://example.com",
      max_length: "not-a-number",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const keys = result.errors.map((e) => e.key);
      expect(keys).toContain("max_length");
    }
  });

  test("accepts boolean widget values directly", () => {
    const result = validateParams(WEB_FETCH, {
      url: "https://example.com",
      raw: true,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.params.raw).toBe(true);
  });

  const EDIT = Type.Object({
    path: Type.String(),
    edits: Type.Array(
      Type.Object({ oldText: Type.String(), newText: Type.String() }),
    ),
  });

  test("parses a valid JSON-fallback field into its structured value", () => {
    const result = validateParams(EDIT, {
      path: "a.ts",
      edits: '[{"oldText":"x","newText":"y"}]',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.params.edits).toEqual([{ oldText: "x", newText: "y" }]);
    }
  });

  test("reports malformed JSON scoped to the fallback field", () => {
    const result = validateParams(EDIT, { path: "a.ts", edits: "[not json" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const edits = result.errors.find((e) => e.key === "edits");
      expect(edits).toBeDefined();
      expect(edits?.message).toContain("invalid JSON");
    }
  });

  test("reports JSON that violates the field's sub-schema, scoped to the field", () => {
    // Valid JSON, but each edit is missing the required `newText`.
    const result = validateParams(EDIT, {
      path: "a.ts",
      edits: '[{"oldText":"x"}]',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.map((e) => e.key)).toContain("edits");
    }
  });
});
