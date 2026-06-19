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
  getAgentDir,
  SessionManager,
} from "@earendil-works/pi-coding-agent";
import type { AgentTool } from "@earendil-works/pi-agent-core";

/** A discovered tool plus its display metadata. */
export interface HarvestedTool {
  tool: AgentTool;
  name: string;
  label: string;
  description: string;
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
  const { session } = await createAgentSession({
    cwd,
    agentDir: getAgentDir(),
    sessionManager: SessionManager.inMemory(cwd),
  });

  const tools: HarvestedTool[] = session.agent.state.tools.map((tool) => ({
    tool,
    name: tool.name,
    label: tool.label ?? tool.name,
    description: tool.description ?? "",
  }));

  return {
    tools,
    dispose: () => session.dispose(),
  };
}
