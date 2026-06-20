/**
 * tool-harvest — thin adapter around session creation + tool extraction.
 *
 * Materializes the real tool set by creating an in-memory agent session with no
 * model selected (no provider credentials required) and reading the session's
 * tool list. The discovered tools keep their real bound `execute`, so the tester
 * drives production behavior exactly; the session is kept alive behind `dispose`
 * and torn down when the app quits.
 */

import {
  createAgentSession,
  createCodingTools,
  createReadOnlyTools,
  getAgentDir,
  SessionManager,
} from "@earendil-works/pi-coding-agent";
import type { AgentTool } from "@earendil-works/pi-agent-core";

/** Where a resolved tool came from: a pi built-in or a local extension. */
export type ToolSource = "built-in" | "extension";

/** A discovered tool plus its display metadata. */
export interface HarvestedTool {
  tool: AgentTool;
  name: string;
  label: string;
  description: string;
  /** Origin of the tool the session actually resolved for this name. */
  source: ToolSource;
  /**
   * The other source that also defines this name but was shadowed by the
   * resolved tool. Set only on name collisions (e.g. an extension `read`
   * overriding the built-in `read`); `undefined` when the name is unique.
   */
  shadowedSource?: ToolSource;
}

/**
 * Attribute a resolved tool to a source and detect a shadowed collision.
 *
 * A name present in the extension set is resolved to the extension (extensions
 * take precedence over built-ins); otherwise it is a built-in. When both sets
 * define the name, the resolved tool shadows the one from the other source.
 */
function attributeSource(
  name: string,
  extensionNames: Set<string>,
  builtinNames: Set<string>,
): Pick<HarvestedTool, "source" | "shadowedSource"> {
  const inExtension = extensionNames.has(name);
  const inBuiltin = builtinNames.has(name);
  const source: ToolSource = inExtension ? "extension" : "built-in";
  const collides = inExtension && inBuiltin;
  return {
    source,
    shadowedSource: collides
      ? source === "extension"
        ? "built-in"
        : "extension"
      : undefined,
  };
}

export interface HarvestResult {
  tools: HarvestedTool[];
  /** Dispose the throwaway session that surfaced these tools. */
  dispose: () => void;
}

/**
 * Create a throwaway session and snapshot its tools.
 *
 * No model is selected and no prompt is sent, so this works offline.
 */
export async function harvestTools(
  cwd: string = process.cwd(),
): Promise<HarvestResult> {
  const { session, extensionsResult } = await createAgentSession({
    cwd,
    agentDir: getAgentDir(),
    sessionManager: SessionManager.inMemory(cwd),
  });

  // Names the extensions register (the source of truth for "extension" tools)
  // and the names pi ships as built-ins, used to label each resolved tool and
  // flag collisions where one source shadows the other.
  const extensionNames = new Set(
    extensionsResult.runtime.getAllTools().map((t) => t.name),
  );
  const builtinNames = new Set(
    [...createCodingTools(cwd), ...createReadOnlyTools(cwd)].map((t) => t.name),
  );

  const tools: HarvestedTool[] = session.agent.state.tools.map((tool) => ({
    tool,
    name: tool.name,
    label: tool.label ?? tool.name,
    description: tool.description ?? "",
    ...attributeSource(tool.name, extensionNames, builtinNames),
  }));

  return {
    tools,
    dispose: () => session.dispose(),
  };
}
