# Slice 03 — JSON-fallback fields

## Parent

[PRD — Tool Tester TUI](./PRD.md)

## What to build

Extend the generated form to handle non-primitive fields so tools with complex
parameters — notably `edit`, whose `edits` is an array of `{oldText, newText}`
objects — can be exercised end-to-end.

- **schema-form:** any field whose type is not a supported primitive (array, object,
  union, etc.) is marked as a JSON-fallback field carrying its sub-schema.
- **Form step:** JSON-fallback fields render a small JSON editor for just that field,
  pre-filled with the default or last value when available.
- **validation:** the JSON entered for a fallback field is parsed and validated against
  that field's sub-schema; malformed or non-conforming JSON is reported as a
  field-scoped error like any other.

After this slice, `edit` (and any future tool with array/object params) is fully
usable in the tester.

## Acceptance criteria

- [ ] Tools with array/object fields (e.g. `edit`) render a JSON editor for those
      fields and the rest of the form as normal widgets.
- [ ] A JSON-fallback field validates its content against the field's sub-schema on
      submit.
- [ ] Malformed JSON or JSON that violates the sub-schema is reported inline and blocks
      the run.
- [ ] `edit` can be run successfully end-to-end with a valid `edits` array entered as
      JSON.
- [ ] `bun test` extends schema-form (non-primitive field is marked as JSON-fallback
      with its sub-schema) and validation (valid JSON, malformed JSON, schema-violating
      JSON) coverage.

## Blocked by

- Blocked by #02 (generated form — primitives).
