/**
 * tui-app — the walking-skeleton wizard controller.
 *
 * Full-screen two-step flow for this slice: a fuzzy-filterable tool list and a
 * raw result view. Selecting a tool runs it for real through tool-runner; the
 * result view dumps content text and stringified details (with an error flag).
 * Parameter entry and rich rendering are stubbed here and thickened later.
 */

import {
  Key,
  matchesKey,
  type Component,
  type SelectItem,
  SelectList,
  truncateToWidth,
  TUI,
  visibleWidth,
  wrapTextWithAnsi,
} from "@earendil-works/pi-tui";
import { getSelectListTheme } from "@earendil-works/pi-coding-agent";

import type { HarvestedTool } from "./tool-harvest";
import { runTool, type ToolRunOutcome } from "./tool-runner";

type Step = "list" | "running" | "result";

/** Minimal ANSI styling — rich theming arrives with later slices. */
const style = {
  bold: (s: string) => `\x1b[1m${s}\x1b[22m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[22m`,
  muted: (s: string) => `\x1b[90m${s}\x1b[39m`,
  accent: (s: string) => `\x1b[36m${s}\x1b[39m`,
  success: (s: string) => `\x1b[32m${s}\x1b[39m`,
  error: (s: string) => `\x1b[31m${s}\x1b[39m`,
  border: (s: string) => `\x1b[90m${s}\x1b[39m`,
};

export class ToolTesterApp implements Component {
  /** Invoked when the user asks to quit. */
  onQuit?: () => void;

  private step: Step = "list";
  private query = "";
  private readonly list: SelectList;
  private readonly byValue = new Map<string, HarvestedTool>();

  private outcome?: ToolRunOutcome;
  private outcomeLabel = "";
  private resultScroll = 0;
  private abort?: AbortController;

  constructor(
    private readonly tui: TUI,
    tools: HarvestedTool[],
    private readonly cwd: string,
  ) {
    const items: SelectItem[] = tools.map((t) => {
      this.byValue.set(t.name, t);
      return {
        value: t.name,
        label: t.label === t.name ? t.name : `${t.label} (${t.name})`,
        description: t.description.split("\n")[0],
      };
    });

    const maxVisible = Math.max(5, this.tui.terminal.rows - 7);
    this.list = new SelectList(items, maxVisible, getSelectListTheme());
    this.list.onSelect = (item) => {
      const harvested = this.byValue.get(item.value);
      if (harvested) void this.run(harvested);
    };
    this.list.onCancel = () => this.quit();
  }

  // --- input -------------------------------------------------------------

  handleInput(data: string): void {
    if (matchesKey(data, Key.ctrl("c"))) {
      if (this.step === "running") {
        this.abort?.abort();
      } else {
        this.quit();
      }
      return;
    }

    if (this.step === "list") {
      this.handleListInput(data);
    } else if (this.step === "result") {
      this.handleResultInput(data);
    }
    // "running": ignore everything except Ctrl+C (handled above).
  }

  private handleListInput(data: string): void {
    if (matchesKey(data, Key.escape)) {
      this.quit();
      return;
    }
    if (matchesKey(data, Key.backspace)) {
      if (this.query.length > 0) {
        this.query = this.query.slice(0, -1);
        this.list.setFilter(this.query);
        this.tui.requestRender();
      }
      return;
    }
    if (isPrintable(data)) {
      this.query += data;
      this.list.setFilter(this.query);
      this.tui.requestRender();
      return;
    }
    // Navigation / selection.
    this.list.handleInput(data);
    this.tui.requestRender();
  }

  private handleResultInput(data: string): void {
    if (matchesKey(data, Key.escape)) {
      this.step = "list";
      this.outcome = undefined;
      this.resultScroll = 0;
      this.tui.requestRender();
      return;
    }
    if (matchesKey(data, Key.up)) {
      this.resultScroll = Math.max(0, this.resultScroll - 1);
      this.tui.requestRender();
    } else if (matchesKey(data, Key.down)) {
      this.resultScroll += 1;
      this.tui.requestRender();
    }
  }

  private async run(harvested: HarvestedTool): Promise<void> {
    this.step = "running";
    this.outcomeLabel = harvested.label;
    this.abort = new AbortController();
    this.tui.requestRender();

    const outcome = await runTool(harvested.tool, {
      signal: this.abort.signal,
      onUpdate: () => this.tui.requestRender(),
    });

    this.outcome = outcome;
    this.step = "result";
    this.resultScroll = 0;
    this.tui.requestRender();
  }

  private quit(): void {
    this.onQuit?.();
  }

  // --- rendering ---------------------------------------------------------

  invalidate(): void {
    this.list.invalidate();
  }

  render(width: number): string[] {
    const rows = this.tui.terminal.rows;
    const lines: string[] = [...this.headerLines(width)];

    if (this.step === "list") {
      lines.push(...this.listLines(width));
    } else if (this.step === "running") {
      lines.push("");
      lines.push(style.accent(`Running ${this.outcomeLabel}…`));
    } else {
      lines.push(...this.resultLines(width, rows - lines.length));
    }

    return toScreen(lines, width, rows);
  }

  private headerLines(width: number): string[] {
    const title = style.bold(style.accent("pi tool tester"));
    const cwd = style.muted(`cwd: ${this.cwd}`);
    return [
      truncateToWidth(`${title}  ${cwd}`, width),
      style.border("─".repeat(width)),
    ];
  }

  private listLines(width: number): string[] {
    const lines: string[] = [];
    const cursor = style.dim("▌");
    lines.push(
      truncateToWidth(style.muted("filter: ") + this.query + cursor, width),
    );
    lines.push("");
    lines.push(...this.list.render(width));
    lines.push("");
    lines.push(style.dim("type to filter · ↑↓ move · enter run · esc quit"));
    return lines;
  }

  private resultLines(width: number, budget: number): string[] {
    const outcome = this.outcome;
    if (!outcome) return [];

    const body = formatOutcome(outcome, this.outcomeLabel, width);
    const hintRows = 2; // blank + hint line
    const viewport = Math.max(1, budget - hintRows);
    const maxScroll = Math.max(0, body.length - viewport);
    if (this.resultScroll > maxScroll) this.resultScroll = maxScroll;

    const visible = body.slice(this.resultScroll, this.resultScroll + viewport);
    const more = maxScroll > 0 ? `  (${this.resultScroll}/${maxScroll})` : "";

    return [
      ...visible,
      "",
      style.dim(`↑↓ scroll · esc back · ctrl+c quit${more}`),
    ];
  }
}

// --- helpers -------------------------------------------------------------

function isPrintable(data: string): boolean {
  if (data.length === 0) return false;
  if (data.startsWith("\x1b")) return false; // escape sequence
  const code = data.charCodeAt(0);
  return code >= 0x20 && code !== 0x7f; // not control / DEL
}

/** Pad/truncate to exactly `rows` lines, each clamped to `width`. */
function toScreen(lines: string[], width: number, rows: number): string[] {
  const out = lines
    .slice(0, rows)
    .map((line) => (visibleWidth(line) > width ? truncateToWidth(line, width) : line));
  while (out.length < rows) out.push("");
  return out;
}

/**
 * Slice-01 raw result dump: a status line, content text as-is, image
 * placeholders, and stringified details. Rich rendering arrives in a later slice.
 */
function formatOutcome(
  outcome: ToolRunOutcome,
  label: string,
  width: number,
): string[] {
  const lines: string[] = [];
  const status = outcome.isError
    ? style.error("● ERROR")
    : style.success("● OK");
  lines.push(
    `${status}  ${style.bold(label)}  ${style.muted(
      `${outcome.durationMs.toFixed(0)}ms · id ${outcome.toolCallId}`,
    )}`,
  );
  if (outcome.error) {
    lines.push(style.error(outcome.error.stack ?? outcome.error.message));
  }
  lines.push("");

  for (const block of outcome.result.content) {
    if (block.type === "text") {
      for (const raw of block.text.split("\n")) {
        lines.push(...wrapOrLine(raw, width));
      }
    } else if (block.type === "image") {
      lines.push(style.muted(`[image ${block.mimeType}]`));
    }
  }

  lines.push("");
  lines.push(style.muted("details:"));
  const details = safeStringify(outcome.result.details);
  for (const raw of details.split("\n")) {
    lines.push(...wrapOrLine(style.dim(raw), width));
  }
  return lines;
}

function wrapOrLine(text: string, width: number): string[] {
  if (text.length === 0) return [""];
  return wrapTextWithAnsi(text, width);
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}
