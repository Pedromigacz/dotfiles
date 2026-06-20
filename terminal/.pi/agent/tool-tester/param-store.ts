/**
 * param-store — load/save of last-used parameters per tool name.
 *
 * Persists the params last entered for each tool to a single JSON file under the
 * pi agent config directory, keyed by tool name, so re-running a tool across
 * launches pre-fills the form with what was used last time. A missing or corrupt
 * store file is tolerated: the store falls back to empty state rather than
 * failing, so the app always launches.
 *
 * Thin I/O glue (no validation logic of its own); validated by manual use.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { getAgentDir } from "@earendil-works/pi-coding-agent";

/** Map of tool name → the params last entered for that tool. */
type StoreShape = Record<string, unknown>;

/** Default location of the store file inside the pi agent config directory. */
export function defaultParamStorePath(): string {
  return join(getAgentDir(), "tool-tester-params.json");
}

/**
 * Last-used parameter store, loaded eagerly from disk and written back on every
 * `remember`. Construction never throws on a missing or corrupt file.
 */
export class ParamStore {
  private readonly path: string;
  private store: StoreShape;

  constructor(path: string = defaultParamStorePath()) {
    this.path = path;
    this.store = load(path);
  }

  /** The params last remembered for `toolName`, or undefined if none. */
  get(toolName: string): unknown {
    return this.store[toolName];
  }

  /** Persist `params` as the last-used values for `toolName`. */
  remember(toolName: string, params: unknown): void {
    this.store[toolName] = params;
    save(this.path, this.store);
  }
}

/** Read and parse the store file, tolerating absence or corruption. */
function load(path: string): StoreShape {
  try {
    if (!existsSync(path)) return {};
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    // Unreadable or malformed file — start from empty state.
    return {};
  }
}

/** Write the store back as pretty JSON; best-effort, never throws. */
function save(path: string, store: StoreShape): void {
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(store, null, 2));
  } catch {
    // Persistence is a convenience; failing to write must not break a run.
  }
}

function isRecord(value: unknown): value is StoreShape {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
