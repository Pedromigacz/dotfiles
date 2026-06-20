import { describe, expect, test } from "bun:test";
import { Type } from "typebox";

import { schemaToFields } from "./schema-form";

describe("schemaToFields", () => {
  test("maps an all-primitive schema to type-appropriate widgets in order", () => {
    const schema = Type.Object({
      name: Type.String(),
      count: Type.Number(),
      size: Type.Integer(),
      enabled: Type.Boolean(),
    });

    const fields = schemaToFields(schema);

    expect(fields.map((f) => f.key)).toEqual([
      "name",
      "count",
      "size",
      "enabled",
    ]);
    expect(fields.map((f) => f.kind)).toEqual([
      "string",
      "number",
      "integer",
      "boolean",
    ]);
    // All declared inline => all required.
    expect(fields.every((f) => f.required)).toBe(true);
  });

  test("marks optional properties as not required", () => {
    const schema = Type.Object({
      url: Type.String(),
      max_length: Type.Optional(Type.Integer()),
      raw: Type.Optional(Type.Boolean()),
    });

    const fields = schemaToFields(schema);
    const required = Object.fromEntries(fields.map((f) => [f.key, f.required]));

    expect(required).toEqual({ url: true, max_length: false, raw: false });
  });

  test("carries description and default through", () => {
    const schema = Type.Object({
      url: Type.String({ description: "Absolute http(s) URL to fetch." }),
      max_length: Type.Optional(
        Type.Integer({ description: "max chars", default: 50000 }),
      ),
    });

    const fields = schemaToFields(schema);
    const byKey = Object.fromEntries(fields.map((f) => [f.key, f]));

    expect(byKey.url.description).toBe("Absolute http(s) URL to fetch.");
    expect(byKey.url.default).toBeUndefined();
    expect(byKey.max_length.description).toBe("max chars");
    expect(byKey.max_length.default).toBe(50000);
  });

  test("marks non-primitive fields as json fallback carrying their sub-schema", () => {
    const editSchema = Type.Object({
      path: Type.String(),
      edits: Type.Array(
        Type.Object({
          oldText: Type.String(),
          newText: Type.String(),
        }),
      ),
    });

    const fields = schemaToFields(editSchema);
    const edits = fields.find((f) => f.key === "edits");

    expect(edits?.kind).toBe("json");
    // The sub-schema is preserved for the JSON-fallback editor (slice 03).
    expect((edits?.schema as { type?: string }).type).toBe("array");
  });

  test("returns an empty list for a schema with no properties", () => {
    expect(schemaToFields(Type.Object({}))).toEqual([]);
  });
});
