/**
 * validation — pure assembly of form widget values into a candidate params
 * object, validated and coerced against the tool's schema using `typebox/value`.
 *
 * The form hands us a map of field key -> raw widget value (a string for text /
 * number / integer inputs, a boolean for checkboxes, or a JSON string for a
 * non-primitive fallback field). We:
 *   1. assemble a candidate object, omitting empty optional inputs and parsing
 *      JSON-fallback strings (reporting malformed JSON as a field error);
 *   2. apply schema defaults and coerce types (`Default` then `Convert`);
 *   3. validate, returning either the coerced params or field-scoped errors.
 *
 * Pure of any UI: it depends only on a TypeBox schema and a values map, so it is
 * testable with plain assertions.
 */

import type { TSchema } from "typebox";
import { Value } from "typebox/value";

/** A validation failure scoped to a field (`key === ""` for form-level). */
export interface FieldError {
  /** The offending field's key, or "" when the error is not field-specific. */
  key: string;
  /** Human-readable message. */
  message: string;
}

/** Either validated params or a list of field-scoped errors. */
export type ValidationResult =
  | { ok: true; params: Record<string, unknown> }
  | { ok: false; errors: FieldError[] };

interface ObjectSchemaShape {
  properties?: Record<string, TSchema>;
}

function isPrimitiveType(sub: TSchema): boolean {
  const type = (sub as { type?: unknown }).type;
  return (
    type === "string" ||
    type === "number" ||
    type === "integer" ||
    type === "boolean"
  );
}

/**
 * Validate raw widget `values` against `schema`.
 *
 * Empty-string inputs are treated as "not provided" and omitted, so schema
 * defaults apply and required-but-blank fields surface as missing-required
 * errors. JSON-fallback fields parse their string value; malformed JSON is
 * reported against that field without invoking the schema validator.
 */
export function validateParams(
  schema: TSchema,
  values: Record<string, unknown>,
): ValidationResult {
  const properties = (schema as ObjectSchemaShape).properties ?? {};
  const candidate: Record<string, unknown> = {};
  const jsonErrors: FieldError[] = [];

  for (const key of Object.keys(properties)) {
    if (!(key in values)) continue;
    const raw = values[key];
    if (raw === undefined) continue;

    const sub = properties[key];

    if (!isPrimitiveType(sub)) {
      // Non-primitive: expect a JSON string from the fallback editor.
      if (typeof raw === "string") {
        const trimmed = raw.trim();
        if (trimmed === "") continue; // blank → omit (let required catch it)
        try {
          candidate[key] = JSON.parse(trimmed);
        } catch (err) {
          jsonErrors.push({
            key,
            message: `invalid JSON: ${
              err instanceof Error ? err.message : String(err)
            }`,
          });
        }
      } else {
        candidate[key] = raw;
      }
      continue;
    }

    // Primitive: omit empty strings so optionals fall back to their default.
    if (typeof raw === "string" && raw === "") continue;
    candidate[key] = raw;
  }

  if (jsonErrors.length > 0) return { ok: false, errors: jsonErrors };

  const defaulted = Value.Default(schema, candidate);
  const coerced = Value.Convert(schema, defaulted) as Record<string, unknown>;

  if (Value.Check(schema, coerced)) {
    return { ok: true, params: coerced };
  }

  return { ok: false, errors: collectErrors(schema, coerced) };
}

/** Flatten TypeBox validation errors into field-scoped messages. */
function collectErrors(schema: TSchema, value: unknown): FieldError[] {
  const errors: FieldError[] = [];
  for (const e of Value.Errors(schema, value)) {
    // A missing top-level property (instancePath "") names the field directly;
    // nested violations (e.g. inside a JSON-fallback array) scope to the
    // top-level field from the path so the error renders next to that widget.
    if (e.keyword === "required" && e.instancePath === "") {
      const missing =
        (e.params as { requiredProperties?: string[] }).requiredProperties ?? [];
      for (const key of missing) {
        errors.push({ key, message: "required" });
      }
      continue;
    }
    errors.push({ key: fieldKeyFromPath(e.instancePath), message: e.message });
  }
  return errors;
}

/** "/max_length" -> "max_length"; "" -> "". */
function fieldKeyFromPath(instancePath: string): string {
  if (!instancePath.startsWith("/")) return "";
  return instancePath.slice(1).split("/")[0] ?? "";
}
