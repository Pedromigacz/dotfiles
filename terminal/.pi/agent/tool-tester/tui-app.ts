/**
 * tui-app — the wizard controller.
 *
 * Full-screen three-step flow: a fuzzy-filterable tool list, a generated
 * parameter form, and a raw result view. Selecting a tool opens a form built
 * from its schema (schema-form); submitting validates the entered values
 * (validation) and, when valid, runs the tool for real through tool-runner with
 * exactly those params. Invalid input is shown inline and blocks the run. The
 * result view dumps content text and stringified details (with an error flag);
 * rich rendering is thickened in a later slice.
 */

import {
  Key,
  Markdown,
  matchesKey,
  type Component,
  type SelectItem,
  SelectList,
  truncateToWidth,
  TUI,
  visibleWidth,
  wrapTextWithAnsi,
} from "@earendil-works/pi-tui";
import {
  type AgentToolResult,
  getMarkdownTheme,
  getSelectListTheme,
} from "@earendil-works/pi-coding-agent";

import type { HarvestedTool } from "./tool-harvest";
import { runTool, type ToolRunOutcome } from "./tool-runner";
import { schemaToFields } from "./schema-form";
import { validateParams } from "./validation";
import { FormView } from "./form-view";
import { formatResult } from "./result-format";
import { ParamStore } from "./param-store";

type Step = "list" | "form" | "running" | "result";

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

  private form?: FormView;
  private currentTool?: HarvestedTool;

  private outcome?: ToolRunOutcome;
  private outcomeLabel = "";
  private resultScroll = 0;
  private detailsExpanded = false;
  private abort?: AbortController;
  /** Latest partial result streamed by an in-flight run, shown live. */
  private partial?: AgentToolResult<unknown>;

  constructor(
    private readonly tui: TUI,
    tools: HarvestedTool[],
    private readonly cwd: string,
    /** Persists/pre-fills each tool's last-used params across launches. */
    private readonly store: ParamStore = new ParamStore(),
  ) {
    const items: SelectItem[] = tools.map((t) => {
      this.byValue.set(t.name, t);
      // Front-load the source badge so the resolved origin (and any shadowed
      // collision) stays visible even when the description is truncated.
      const badge = sourceBadge(t);
      const desc = t.description.split("\n")[0];
      return {
        value: t.name,
        label: t.label === t.name ? t.name : `${t.label} (${t.name})`,
        description: desc ? `${badge}  ${desc}` : badge,
      };
    });

    const maxVisible = Math.max(5, this.tui.terminal.rows - 7);
    this.list = new SelectList(items, maxVisible, getSelectListTheme());
    this.list.onSelect = (item) => {
      const harvested = this.byValue.get(item.value);
      if (harvested) this.openForm(harvested);
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
    } else if (this.step === "form") {
      this.form?.handleInput(data);
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
      // Step back to the form (if any) so params can be tweaked and re-run.
      this.step = this.form ? "form" : "list";
      this.outcome = undefined;
      this.resultScroll = 0;
      this.tui.requestRender();
      return;
    }
    if (data === "d" || data === "D") {
      // Toggle the structured details between collapsed summary and full JSON.
      this.detailsExpanded = !this.detailsExpanded;
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

  /** Build a parameter form from the tool's schema and show the form step. */
  private openForm(harvested: HarvestedTool): void {
    this.currentTool = harvested;
    const fields = schemaToFields(harvested.tool.parameters);
    // Pre-fill with this tool's last-used params; fields without a stored
    // value fall back to their schema defaults inside FormView.
    const stored = this.store.get(harvested.name);
    const initialValues = isRecord(stored) ? stored : undefined;
    const form = new FormView(this.tui, fields, initialValues);
    form.onCancel = () => {
      this.step = "list";
      this.form = undefined;
      this.currentTool = undefined;
      this.tui.requestRender();
    };
    form.onSubmit = () => this.submitForm();
    this.form = form;
    this.step = "form";
    this.tui.requestRender();
  }

  /** Validate the form's values; run on success, show inline errors otherwise. */
  private submitForm(): void {
    const form = this.form;
    const tool = this.currentTool;
    if (!form || !tool) return;

    const result = validateParams(tool.tool.parameters, form.getValues());
    if (!result.ok) {
      form.setErrors(result.errors);
      this.tui.requestRender();
      return;
    }
    form.setErrors([]);
    void this.run(tool, result.params);
  }

  private async run(
    harvested: HarvestedTool,
    params: unknown,
  ): Promise<void> {
    this.step = "running";
    this.outcomeLabel = harvested.label;
    this.outcome = undefined;
    this.partial = undefined;
    this.abort = new AbortController();
    this.tui.requestRender();

    // Remember the exact params used so reopening this tool pre-fills them.
    this.store.remember(harvested.name, params);

    const outcome = await runTool(harvested.tool, {
      params,
      signal: this.abort.signal,
      // Stash each streamed partial so the running view re-renders it live.
      onUpdate: (partial) => {
        this.partial = partial;
        this.tui.requestRender();
      },
    });

    this.outcome = outcome;
    this.partial = undefined;
    this.abort = undefined;
    this.step = "result";
    this.resultScroll = 0;
    this.detailsExpanded = false;
    this.tui.requestRender();
  }

  private quit(): void {
    this.onQuit?.();
  }

  // --- rendering ---------------------------------------------------------

  invalidate(): void {
    this.list.invalidate();
    this.form?.invalidate();
  }

  render(width: number): string[] {
    const rows = this.tui.terminal.rows;
    const lines: string[] = [...this.headerLines(width)];

    if (this.step === "list") {
      lines.push(...this.listLines(width));
    } else if (this.step === "form") {
      lines.push(...this.formLines(width));
    } else if (this.step === "running") {
      lines.push(...this.runningLines(width, rows - lines.length));
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

  private formLines(width: number): string[] {
    const lines: string[] = [];
    const tool = this.currentTool;
    if (tool) {
      lines.push(`${style.bold(tool.label)}  ${style.muted(sourceBadge(tool))}`);
      const desc = tool.description.split("\n")[0];
      if (desc) lines.push(style.muted(desc));
    }
    lines.push("");
    if (this.form) lines.push(...this.form.render(width));
    return lines;
  }

  /**
   * Render the in-flight run: a status/cancel line plus any partial content the
   * tool has streamed so far via its update callback. When the streamed output
   * overflows the viewport its tail is shown, so the latest progress stays
   * visible. Tools that never stream simply show the status line.
   */
  private runningLines(width: number, budget: number): string[] {
    const header = [
      "",
      `${style.accent(`Running ${this.outcomeLabel}…`)}  ${style.dim(
        "ctrl+c cancel",
      )}`,
      "",
    ];

    const partial = this.partial;
    if (!partial) return header;

    const model = formatResult({
      content: partial.content,
      details: partial.details,
      isError: false,
      durationMs: 0,
    });

    const body: string[] = [];
    for (const segment of model.content) {
      if (segment.kind === "markdown") {
        body.push(...renderMarkdown(segment.text, width));
      } else {
        body.push(style.muted(segment.placeholder));
      }
    }

    const viewport = Math.max(1, budget - header.length);
    const tail = body.length > viewport ? body.slice(body.length - viewport) : body;
    return [...header, ...tail];
  }

  private resultLines(width: number, budget: number): string[] {
    const outcome = this.outcome;
    if (!outcome) return [];

    const model = formatResult({
      content: outcome.result.content,
      details: outcome.result.details,
      isError: outcome.isError,
      durationMs: outcome.durationMs,
      error: outcome.error,
    });
    const body = renderResult(
      model,
      this.outcomeLabel,
      outcome.toolCallId,
      width,
      this.detailsExpanded,
    );

    const hintRows = 2; // blank + hint line
    const viewport = Math.max(1, budget - hintRows);
    const maxScroll = Math.max(0, body.length - viewport);
    if (this.resultScroll > maxScroll) this.resultScroll = maxScroll;

    const visible = body.slice(this.resultScroll, this.resultScroll + viewport);
    const more = maxScroll > 0 ? `  (${this.resultScroll}/${maxScroll})` : "";
    const detailsHint = model.details
      ? this.detailsExpanded
        ? " · d collapse"
        : " · d details"
      : "";

    return [
      ...visible,
      "",
      style.dim(`↑↓ scroll${detailsHint} · esc back · ctrl+c quit${more}`),
    ];
  }
}

// --- helpers -------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A compact source indicator for a tool: its resolved origin, and — on a name
 * collision — the other source it shadows, so the collision is never silently
 * hidden behind the resolved tool.
 */
function sourceBadge(tool: HarvestedTool): string {
  if (tool.shadowedSource) {
    return `[${tool.source} · shadows ${tool.shadowedSource}]`;
  }
  return `[${tool.source}]`;
}

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
 * Render a result-format display model into screen lines: a status line with the
 * duration, an error banner when flagged, content (markdown text + image
 * placeholders), and the structured details as collapsed summary or full JSON.
 */
function renderResult(
  model: ReturnType<typeof formatResult>,
  label: string,
  toolCallId: string,
  width: number,
  detailsExpanded: boolean,
): string[] {
  const lines: string[] = [];

  const status = model.isError
    ? style.error("● ERROR")
    : style.success("● OK");
  lines.push(
    `${status}  ${style.bold(label)}  ${style.muted(
      `${model.durationLabel} · id ${toolCallId}`,
    )}`,
  );

  if (model.errorBanner) {
    lines.push("");
    for (const raw of model.errorBanner.split("\n")) {
      lines.push(...wrapOrLine(style.error(raw), width));
    }
  }

  lines.push("");
  for (const segment of model.content) {
    if (segment.kind === "markdown") {
      lines.push(...renderMarkdown(segment.text, width));
    } else {
      lines.push(style.muted(segment.placeholder));
    }
  }

  if (model.details) {
    lines.push("");
    if (detailsExpanded) {
      lines.push(style.muted("details:"));
      for (const raw of model.details.json.split("\n")) {
        lines.push(...wrapOrLine(style.dim(raw), width));
      }
    } else {
      lines.push(style.muted(`details: ${model.details.summary}`));
    }
  }

  return lines;
}

/** Render markdown text to lines using the shared interactive theme. */
function renderMarkdown(text: string, width: number): string[] {
  const md = new Markdown(text, 0, 0, getMarkdownTheme());
  return md.render(width);
}

function wrapOrLine(text: string, width: number): string[] {
  if (text.length === 0) return [""];
  return wrapTextWithAnsi(text, width);
}
