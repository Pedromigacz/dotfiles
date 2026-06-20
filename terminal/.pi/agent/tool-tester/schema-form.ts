/**
 * schema-form — pure transform from a TypeBox schema to an ordered list of form
 * field descriptors.
 *
 * Each descriptor carries the field's key, widget kind (string / number /
 * integer / boolean), required flag, description, and default. Non-primitive
 * fields (array / object / union / etc.) are marked with the `json` kind and
 * carry their sub-schema, so the form can fall back to a JSON editor for them
 * (slice 03); this slice renders them as not-yet-supported.
 *
 * Pure and dependency-light: it reads the schema's structure only, so it is
 * testable with plain TypeBox schemas and no terminal or live session.
 */

import type { TSchema } from "typebox";

/** Widget to render for a field. `json` is the non-primitive fallback. */
export type WidgetKind = "string" | "number" | "integer" | "boolean" | "json";

/** A single form field derived from one schema property. */
export interface FieldDescriptor {
  /** Property key as it appears in the params object. */
  key: string;
  /** Which input widget to render. */
  kind: WidgetKind;
  /** True when the schema lists this property as required. */
  required: boolean;
  /** Property description, if the schema provides one. */
  description?: string;
  /** Schema default, if present. */
  default?: unknown;
  /** The property's own sub-schema (used for JSON-fallback validation). */
  schema: TSchema;
}

/** Structural view of the bits of an object schema we read. */
interface ObjectSchemaShape {
  properties?: Record<string, TSchema>;
  required?: string[];
}

/**
 * Map a property's sub-schema to a widget kind. Anything that is not a single
 * primitive type becomes the `json` fallback.
 */
function widgetKind(sub: TSchema): WidgetKind {
  const type = (sub as { type?: unknown }).type;
  if (type === "string") return "string";
  if (type === "number") return "number";
  if (type === "integer") return "integer";
  if (type === "boolean") return "boolean";
  return "json";
}

/**
 * Transform a TypeBox object schema into an ordered list of field descriptors,
 * preserving property declaration order. A schema with no properties yields an
 * empty list.
 */
export function schemaToFields(schema: TSchema): FieldDescriptor[] {
  const shape = schema as ObjectSchemaShape;
  const properties = shape.properties ?? {};
  const required = new Set(shape.required ?? []);

  return Object.keys(properties).map((key) => {
    const sub = properties[key];
    const meta = sub as { description?: string; default?: unknown };
    const descriptor: FieldDescriptor = {
      key,
      kind: widgetKind(sub),
      required: required.has(key),
      schema: sub,
    };
    if (meta.description !== undefined) descriptor.description = meta.description;
    if (meta.default !== undefined) descriptor.default = meta.default;
    return descriptor;
  });
}
