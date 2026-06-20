/**
 * form-view — the generated parameter form (slice 02).
 *
 * Renders one type-appropriate widget per primitive schema field: a text input
 * for string / number / integer, a toggle for boolean. Each field shows its
 * required marker, description, and pre-filled default, plus any inline
 * validation error. Non-primitive fields are shown as not-yet-supported (the
 * JSON-fallback editor arrives in slice 03).
 *
 * This is terminal glue — wiring the schema-form descriptors to `pi-tui` widgets
 * and collecting their values for the validation module. It owns no validation
 * logic itself.
 */

import { Input, Key, matchesKey, type Component, type TUI } from "@earendil-works/pi-tui";

import type { FieldDescriptor } from "./schema-form";
import type { FieldError } from "./validation";

/** ANSI styling, matching tui-app's minimal palette. */
const style = {
  bold: (s: string) => `\x1b[1m${s}\x1b[22m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[22m`,
  muted: (s: string) => `\x1b[90m${s}\x1b[39m`,
  accent: (s: string) => `\x1b[36m${s}\x1b[39m`,
  error: (s: string) => `\x1b[31m${s}\x1b[39m`,
  required: (s: string) => `\x1b[33m${s}\x1b[39m`,
};

interface FormField {
  descriptor: FieldDescriptor;
  /** Text input for string / number / integer; undefined for boolean / json. */
  input?: Input;
  /** Current value for boolean fields. */
  boolValue?: boolean;
  /** Whether the user can focus and edit this field. json fields cannot. */
  focusable: boolean;
}

export class FormView implements Component {
  /** Called when the user submits the form (asks to run). */
  onSubmit?: () => void;
  /** Called when the user backs out of the form. */
  onCancel?: () => void;

  private readonly fields: FormField[];
  private readonly focusOrder: number[];
  private focusPos = 0;
  private errors = new Map<string, string>();

  constructor(
    private readonly tui: TUI,
    descriptors: FieldDescriptor[],
  ) {
    this.fields = descriptors.map((descriptor) => this.buildField(descriptor));
    this.focusOrder = this.fields
      .map((f, i) => (f.focusable ? i : -1))
      .filter((i) => i >= 0);
  }

  private buildField(descriptor: FieldDescriptor): FormField {
    if (descriptor.kind === "boolean") {
      const value =
        typeof descriptor.default === "boolean" ? descriptor.default : false;
      return { descriptor, boolValue: value, focusable: true };
    }
    if (descriptor.kind === "json") {
      // Not editable in this slice — shown as not-yet-supported.
      return { descriptor, focusable: false };
    }
    const input = new Input();
    if (descriptor.default !== undefined) {
      input.setValue(String(descriptor.default));
    }
    return { descriptor, input, focusable: true };
  }

  // --- values ------------------------------------------------------------

  /** Collect raw widget values keyed by field, for the validation module. */
  getValues(): Record<string, unknown> {
    const values: Record<string, unknown> = {};
    for (const field of this.fields) {
      if (!field.focusable) continue; // json: omitted this slice
      values[field.descriptor.key] =
        field.input !== undefined ? field.input.getValue() : field.boolValue;
    }
    return values;
  }

  setErrors(errors: FieldError[]): void {
    this.errors = new Map(errors.map((e) => [e.key, e.message]));
  }

  // --- input -------------------------------------------------------------

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape)) {
      this.onCancel?.();
      return;
    }
    if (matchesKey(data, Key.enter)) {
      this.onSubmit?.();
      return;
    }
    if (
      matchesKey(data, Key.tab) ||
      matchesKey(data, Key.down) ||
      matchesKey(data, Key.ctrl("n"))
    ) {
      this.moveFocus(1);
      return;
    }
    if (
      matchesKey(data, Key.shift("tab")) ||
      matchesKey(data, Key.up) ||
      matchesKey(data, Key.ctrl("p"))
    ) {
      this.moveFocus(-1);
      return;
    }

    const field = this.focusedField();
    if (!field) return;

    if (field.input) {
      field.input.handleInput(data);
      this.tui.requestRender();
      return;
    }
    // Boolean field: space toggles.
    if (data === " ") {
      field.boolValue = !field.boolValue;
      this.tui.requestRender();
    }
  }

  private moveFocus(delta: number): void {
    if (this.focusOrder.length === 0) return;
    this.focusPos =
      (this.focusPos + delta + this.focusOrder.length) % this.focusOrder.length;
    this.syncFocus();
    this.tui.requestRender();
  }

  private focusedField(): FormField | undefined {
    const index = this.focusOrder[this.focusPos];
    return index === undefined ? undefined : this.fields[index];
  }

  /** Mirror the logical focus onto the underlying Input components. */
  private syncFocus(): void {
    const focused = this.focusedField();
    for (const field of this.fields) {
      if (field.input) field.input.focused = field === focused;
    }
  }

  // --- rendering ---------------------------------------------------------

  invalidate(): void {
    for (const field of this.fields) field.input?.invalidate();
  }

  render(width: number): string[] {
    this.syncFocus();
    const lines: string[] = [];

    if (this.fields.length === 0) {
      lines.push(style.muted("(this tool takes no parameters)"));
    }

    this.fields.forEach((field, index) => {
      const isFocused = this.focusOrder[this.focusPos] === index;
      lines.push(this.labelLine(field, isFocused));
      const desc = field.descriptor.description;
      if (desc) lines.push("  " + style.muted(desc.split("\n")[0]));
      lines.push(...this.widgetLines(field, width));
      const error = this.errors.get(field.descriptor.key);
      if (error) lines.push("  " + style.error(`✗ ${error}`));
      lines.push("");
    });

    lines.push(
      style.dim("tab/↑↓ move · space toggle · enter run · esc back"),
    );
    return lines;
  }

  private labelLine(field: FormField, focused: boolean): string {
    const { key, required, kind } = field.descriptor;
    const marker = required ? style.required(" *") : "";
    const name = focused ? style.accent(style.bold(key)) : style.bold(key);
    return `${focused ? style.accent("› ") : "  "}${name}${marker}  ${style.muted(`(${kind})`)}`;
  }

  private widgetLines(field: FormField, width: number): string[] {
    if (field.input) {
      return field.input.render(width - 2).map((l) => "  " + l);
    }
    if (field.descriptor.kind === "boolean") {
      const on = field.boolValue;
      const box = on ? "[x]" : "[ ]";
      return ["  " + `${box} ${on ? "true" : "false"}`];
    }
    return ["  " + style.muted("non-primitive — JSON editor coming in slice 03")];
  }
}
