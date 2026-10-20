import type { Config, Plugin, PluginOptions } from "@opencode-ai/plugin"
import type { Config as CurrentConfig } from "@opencode-ai/sdk/v2"
import { ask, fastDecision, type Request, type ToolCall } from "./policy"
import { review, REVIEWER, SYSTEM } from "./reviewer"
import { abortable } from "./abort"

function settings(input: PluginOptions = {}) {
  const result = {
    enabled: input.enabled ?? true,
    model: process.env.OPENCODE_AUTO_MODE_MODEL ?? input.model ?? "openai/gpt-6-astra",
    timeoutMs: input.timeoutMs ?? 20_000,
    minConfidence: input.minConfidence ?? 0.9,
    maxConcurrentReviews: input.maxConcurrentReviews ?? 2,
    notify: input.notify ?? true,
  }
  if (typeof result.enabled !== "boolean" || typeof result.notify !== "boolean" ||
      typeof result.model !== "string" || !/^[^/\s]+\/\S+$/.test(result.model) ||
      typeof result.timeoutMs !== "number" || !Number.isFinite(result.timeoutMs) || result.timeoutMs < 100 || result.timeoutMs > 120_000 ||
      typeof result.minConfidence !== "number" || !Number.isFinite(result.minConfidence) || result.minConfidence < 0 || result.minConfidence > 1 ||
      typeof result.maxConcurrentReviews !== "number" || !Number.isInteger(result.maxConcurrentReviews) || result.maxConcurrentReviews < 1 || result.maxConcurrentReviews > 10) {
    throw new Error("Invalid auto-mode plugin options")
  }
  return result as { enabled: boolean; model: string; timeoutMs: number; minConfidence: number; maxConcurrentReviews: number; notify: boolean }
}

// Keep this module's only runtime export a plugin function (OpenCode loads all exports).
const AutoMode: Plugin = async ({ client, directory, worktree }, input) => {
  const options = settings(input)
  if (!options.enabled || process.env.OPENCODE_AUTO_MODE_DISABLED === "1") return {}

  // Dotfiles symlinks can load this same file as both a global and local plugin.
  const registryKey = Symbol.for("opencode.auto-mode.clients")
  const registry = globalThis as unknown as Record<symbol, WeakSet<object>>
  const clients = registry[registryKey] ??= new WeakSet<object>()
  if (clients.has(client)) return {}
  clients.add(client)

  const calls = new Map<string, ToolCall>()
  const pending = new Map<string, { sessionID: string; controller: AbortController; responding: boolean }>()
  const reviewerSessions = new Set<string>()
  let activeReviews = 0
  const key = (sessionID: string, callID: string) => `${sessionID}:${callID}`

  async function log(message: string, extra: Record<string, unknown>) {
    try {
      await client.app.log({ body: { service: "auto-mode", level: "info", message, extra }, signal: AbortSignal.timeout(2000) })
    } catch { /* Logging must not affect authorization. */ }
  }

  async function handle(request: Request) {
    if (pending.has(request.id) || reviewerSessions.has(request.sessionID)) return
    const controller = new AbortController()
    pending.set(request.id, { sessionID: request.sessionID, controller, responding: false })
    const timer = setTimeout(() => controller.abort(), options.timeoutMs)
    const signal = controller.signal
    try {
      let call = request.tool ? calls.get(key(request.sessionID, request.tool.callID)) : undefined
      // A second lookup recovers calls on resumed sessions and nested tool paths.
      if (!call && request.tool) {
        const message = await abortable(client.session.message({
          path: { id: request.sessionID, messageID: request.tool.messageID }, signal,
        }), signal)
        const part = message.data?.parts.find((part) => part.type === "tool" && part.callID === request.tool?.callID)
        if (part?.type === "tool") call = { tool: part.tool, args: part.state.input }
      }
      let decision = await fastDecision(request, call, directory, worktree)
      if (!decision) {
        if (activeReviews >= options.maxConcurrentReviews) decision = ask("Reviewer is busy; please decide this request")
        else if (!call) decision = ask("Full tool arguments are unavailable")
        else {
          activeReviews++
          try {
            const messages = await abortable(client.session.messages({
              path: { id: request.sessionID }, query: { limit: 20 }, signal, throwOnError: true,
            }), signal)
            const userMessages = (messages.data ?? []).filter((entry) => entry.info.role === "user")
              .slice(-3).map((entry) => ({
                role: "user",
                text: entry.parts.filter((part) => part.type === "text" && !part.synthetic && !part.ignored)
                  .map((part) => part.type === "text" ? part.text : "").join("\n"),
              })).filter((entry) => entry.text)
            if (!userMessages.length) decision = ask("User task context is unavailable")
            else decision = await review(client, options, {
              directory, worktree, permission: request.permission, patterns: request.patterns,
              metadata: request.metadata, tool: call, recentUserMessages: userMessages,
            }, reviewerSessions, signal)
          } finally { activeReviews-- }
        }
      }
      if (signal.aborted || !pending.has(request.id)) return
      // Reply only to this request. Never create a persistent wildcard grant.
      if (decision.decision !== "ask") {
        pending.get(request.id)!.responding = true
        await client.postSessionIdPermissionsPermissionId({
          path: { id: request.sessionID, permissionID: request.id },
          body: { response: decision.decision === "allow" ? "once" : "reject" },
          signal, throwOnError: true,
        })
      }
      await log(decision.reason, { requestID: request.id, sessionID: request.sessionID, permission: request.permission, decision: decision.decision, confidence: decision.confidence })
      if (options.notify && decision.decision !== "allow") {
        await client.tui.showToast({
          body: { title: `Auto mode: ${decision.decision === "deny" ? "denied" : "your decision"}`, message: decision.reason, variant: decision.decision === "deny" ? "warning" : "info", duration: 5000 },
          signal: AbortSignal.timeout(2000),
        }).catch(() => {})
      }
    } catch {
      await log("Automatic review unavailable; leaving permission to the user", { requestID: request.id })
    } finally {
      clearTimeout(timer)
      pending.delete(request.id)
    }
  }

  const hooks = {
    dispose: async () => {
      for (const item of pending.values()) item.controller.abort()
      pending.clear()
      calls.clear()
      clients.delete(client)
    },
    config: async (legacy: Config) => {
      // Plugin Hooks still reference the frozen legacy SDK config declaration.
      const config = legacy as unknown as CurrentConfig
      // Existing user rules come last. Do not add broad git wildcard allows:
      // OpenCode patterns cannot distinguish a read from shell injection.
      const defaults: Record<string, "ask"> = { bash: "ask", webfetch: "ask" }
      for (const name of Object.keys(config.mcp ?? {})) defaults[`${name}_*`] = "ask"
      if (typeof config.permission !== "string") {
        const existing = config.permission ?? {}
        // Overwriting a property with object spread doesn't move its position.
        // Remove collisions first to preserve the user's last-match-wins order.
        const missing = Object.fromEntries(Object.entries(defaults).filter(([name]) => !(name in existing)))
        config.permission = { ...missing, ...existing }
      }
      config.agent ??= {}
      config.agent[REVIEWER] = {
        description: "Internal, tool-less auto-mode permission classifier",
        mode: "subagent", hidden: true, model: options.model, steps: 1,
        permission: { "*": "deny" }, prompt: SYSTEM,
      }
    },
    "tool.execute.before": async (event, output) => {
      if (reviewerSessions.has(event.sessionID)) throw new Error("The permission reviewer cannot execute tools")
      // Bound memory even when tools fail without an after event.
      if (calls.size >= 1000) calls.delete(calls.keys().next().value!)
      calls.set(key(event.sessionID, event.callID), { tool: event.tool, args: structuredClone(output.args) })
    },
    "tool.execute.after": async (event) => { calls.delete(key(event.sessionID, event.callID)) },
    "experimental.chat.system.transform": async (event, output) => {
      if (event.sessionID && reviewerSessions.has(event.sessionID)) output.system = [SYSTEM]
    },
    event: async ({ event: raw }) => {
      // The bundled SDK's legacy Event union predates permission.asked.
      const event = raw as unknown as { type: string; properties: Record<string, unknown> }
      if (event.type === "permission.asked") {
        const request = event.properties as unknown as Request
        if (typeof request.id !== "string" || typeof request.sessionID !== "string" ||
            typeof request.permission !== "string" || !Array.isArray(request.patterns) ||
            !request.patterns.every((pattern) => typeof pattern === "string") || !request.metadata) return
        await handle(request)
      }
      if (event.type === "permission.replied") {
        const id = String(event.properties.requestID)
        const item = pending.get(id)
        if (!item?.responding) item?.controller.abort()
        pending.delete(id)
      }
      if (event.type === "session.deleted") {
        const info = event.properties.info as { id?: string } | undefined
        for (const [id, item] of pending) if (item.sessionID === info?.id) {
          item.controller.abort()
          pending.delete(id)
        }
        for (const id of calls.keys()) if (id.startsWith(`${info?.id}:`)) calls.delete(id)
      }
    },
  } satisfies Awaited<ReturnType<Plugin>> & { dispose: () => Promise<void> }
  return hooks
}

export default AutoMode
