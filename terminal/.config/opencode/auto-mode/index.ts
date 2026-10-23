import { Plugin, type PluginOptions } from "@opencode/plugin"
import { ask, fastDecision, type ToolCall } from "./policy"
import { review } from "./reviewer"
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

export default Plugin.define({
  id: "auto-mode",
  async setup(ctx) {
    const options = settings(ctx.options)
    if (!options.enabled || process.env.OPENCODE_AUTO_MODE_DISABLED === "1") return
    const calls = new Map<string, ToolCall & { agent: string; messageID: string }>()
    const pending = new Set<AbortController>()
    let activeReviews = 0
    const key = (sessionID: string, id: string) => `${sessionID}:${id}`

    await ctx.tool.hook("execute.before", (event) => {
      if (event.agent !== "automode") return
      if (calls.size >= 1000) calls.delete(calls.keys().next().value!)
      if (event.input && typeof event.input === "object" && !Array.isArray(event.input)) {
        calls.set(key(event.sessionID, event.id), {
          tool: event.tool, args: structuredClone(event.input) as Record<string, unknown>,
          agent: event.agent, messageID: event.messageID,
        })
      }
    })
    await ctx.tool.hook("execute.after", (event) => { calls.delete(key(event.sessionID, event.id)) })

    await ctx.permission.hook("evaluate", async (event) => {
      if (event.effect !== "ask" || event.agent !== "automode" || !event.source) return
      const controller = new AbortController()
      pending.add(controller)
      const timer = setTimeout(() => controller.abort(), options.timeoutMs)
      const signal = controller.signal
      let decision = ask("Automatic review unavailable; please decide this request")
      try {
        const source = event.source
        let call: ToolCall | undefined = calls.get(key(event.sessionID, source.id))
        const cached = calls.get(key(event.sessionID, source.id))
        if (cached && cached.messageID !== source.messageID) call = undefined
        const messages = await abortable(ctx.session.context({ sessionID: event.sessionID }, { signal }), signal)
        if (!call) {
          const owner = messages.find((message) => message.id === source.messageID)
          if (owner?.type !== "assistant" || owner.agent !== "automode") return
          const part = owner.content.find((part) => part.type === "tool" && part.id === source.id)
          if (part?.type === "tool" && part.state.status !== "streaming") call = { tool: part.name, args: part.state.input }
        }
        const session = await abortable(ctx.session.get({ sessionID: event.sessionID }, { signal }), signal)
        const directory = session.location.directory
        const request = {
          id: source.id, sessionID: event.sessionID, permission: event.action,
          patterns: [...event.resources], metadata: event.metadata ?? {},
        }
        const fast = await abortable(fastDecision(request, call, directory, ctx.location.project.directory), signal)
        if (fast) decision = fast
        else if (!call) decision = ask("Full tool arguments are unavailable")
        else if (activeReviews >= options.maxConcurrentReviews) decision = ask("Reviewer is busy; please decide this request")
        else {
          const recentUserMessages = messages.slice(-20).filter((message) => message.type === "user")
            .slice(-3).map((message) => ({ role: "user", text: message.text })).filter((message) => message.text)
          if (!recentUserMessages.length) decision = ask("User task context is unavailable")
          else {
            activeReviews++
            try {
              decision = await review(ctx, options, { directory, permission: event.action,
                patterns: event.resources, metadata: event.metadata, tool: call, recentUserMessages }, signal)
            } finally { activeReviews-- }
          }
        }
      } catch { /* Keep the native user prompt on failures or cancellation. */ }
      finally { clearTimeout(timer); pending.delete(controller) }
      if (signal.aborted) decision = ask("Automatic review timed out or was cancelled")
      event.effect = decision.decision
      event.message = decision.reason
      if (options.notify) console.info("auto-mode", { sessionID: event.sessionID, action: event.action, ...decision })
    })
    return () => {
      for (const controller of pending) controller.abort()
      pending.clear()
      calls.clear()
    }
  },
})
