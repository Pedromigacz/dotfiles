# Slice 02 — Generated form (primitives)

## Parent

[PRD — Tool Tester TUI](./PRD.md)

## What to build

Replace the skeleton's empty-params step with a parameter form generated from the
selected tool's own schema, covering all primitive field types. After picking a tool
I see a form, fill it in, and run with exactly those values — validated first.

This introduces two pure modules and wires them into the wizard:

- **schema-form:** transforms a TypeBox schema into an ordered list of field
  descriptors — key, widget kind (string / number / integer / boolean), required
  flag, description, and default. (Non-primitive fields are deferred to slice 03; here
  they may be omitted or shown as not-yet-supported.)
- **validation:** assembles the form's widget values into a candidate params object,
  applies schema defaults, coerces, and validates against the tool's schema using
  `typebox/value`, returning either validated params or field-scoped errors.

The form step renders a type-appropriate input per field with the required marker,
description, and pre-filled default; submitting validates and either runs the tool or
shows inline errors next to the offending fields.

## Acceptance criteria

- [ ] Selecting a tool shows a form with one input per primitive schema field.
- [ ] Each field shows its description, marks whether it is required, and pre-fills the
      schema default when present.
- [ ] Inputs are type-appropriate (text, number, boolean).
- [ ] Submitting validates the entered values against the tool's schema before running.
- [ ] Invalid input (missing required, wrong type) is reported inline and blocks the
      run until fixed.
- [ ] A valid submission runs the real tool with the entered params and shows the
      result.
- [ ] `bun test` covers schema-form (descriptor output for all-primitive, optional, and
      defaulted schemas) and validation (valid coercion + each error case) through their
      public interfaces.

## Blocked by

- Blocked by #01 (walking skeleton).
