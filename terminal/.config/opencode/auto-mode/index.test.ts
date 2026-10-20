import { describe, expect, test } from "bun:test"
import type { Config, Hooks, PluginInput } from "@opencode-ai/plugin"
import type { Config as CurrentConfig } from "@opencode-ai/sdk/v2"
import AutoMode from "./index"
import { REVIEWER } from "./reviewer"

type Prompt = (input: any) => Promise<any>
function fixture(prompt?: Prompt) {
  const replies: any[] = []
  const prompts: any[] = []
  const creates: any[] = []
  const deleted: string[] = []
  let count = 0
  const client = {
    app: { log: async () => ({}) }, tui: { showToast: async () => ({}) },
    session: {
      create: async (input: any) => { creates.push(input); return { data: { id: `review-${++count}` } } },
      prompt: async (input: any) => {
        prompts.push(input)
        if (prompt) return prompt(input)
        return { data: { info: {}, parts: [{ type: "text", text: '{"decision":"allow","reason":"Scoped task","confidence":0.99}' }] } }
      },
      abort: async () => ({}),
      delete: async (input: any) => { deleted.push(input.path.id); return {} },
      messages: async () => ({ data: [{ info: { role: "user" }, parts: [{ type: "text", text: "Run local tests." }] }] }),
      message: async () => ({}),
    },
    postSessionIdPermissionsPermissionId: async (input: any) => { replies.push(input); return {} },
  }
  return { client, input: { client, directory: "/nonexistent", worktree: "/nonexistent" } as unknown as PluginInput, replies, prompts, creates, deleted }
}

async function emit(hooks: Hooks, type: string, properties: any) {
  await hooks.event!({ event: { type, properties } as any })
}
async function request(hooks: Hooks, id = "permission-1", command = "bun test") {
  await hooks["tool.execute.before"]!({ tool: "bash", sessionID: "main", callID: id }, { args: { command } })
  await emit(hooks, "permission.asked", {
    id, sessionID: "main", permission: "bash", patterns: [command], metadata: { command },
    tool: { callID: id, messageID: "message-1" },
  })
}

describe("plugin lifecycle", () => {
  test("adds review defaults while respecting user rules and isolates the reviewer", async () => {
    const f = fixture()
    const hooks = await AutoMode(f.input)
    const config: CurrentConfig = { permission: { bash: { "*": "ask", "git push*": "deny" } }, mcp: { example: { type: "local", command: ["server"] } } }
    await hooks.config!(config as unknown as Config)
    expect(config.permission).toEqual({ bash: { "*": "ask", "git push*": "deny" }, webfetch: "ask", "example_*": "ask" })
    expect(config.agent?.[REVIEWER]?.permission).toEqual({ "*": "deny" })
    expect(config.agent?.[REVIEWER]?.hidden).toBe(true)
    expect(config.agent?.plan).toBeUndefined()
  })
  test("preserves blanket permissions and disabled mode", async () => {
    const hooks = await AutoMode(fixture().input)
    const config: CurrentConfig = { permission: "deny" }
    await hooks.config!(config as unknown as Config)
    expect(config.permission).toBe("deny")
    expect(await AutoMode(fixture().input, { enabled: false })).toEqual({})
  })
  test("preserves last-match-wins order of explicit wildcard and deny rules", async () => {
    const hooks = await AutoMode(fixture().input)
    const config: CurrentConfig = { permission: { "*": "allow", bash: "deny", webfetch: "deny" } }
    await hooks.config!(config as unknown as Config)
    expect(Object.entries(config.permission!)).toEqual([["*", "allow"], ["bash", "deny"], ["webfetch", "deny"]])
  })
  test("handles global/local symlink duplicate loading once", async () => {
    const f = fixture()
    expect(Object.keys(await AutoMode(f.input)).length).toBeGreaterThan(0)
    expect(await AutoMode(f.input)).toEqual({})
  })
  test("approves once, using full arguments and user context, then deletes review session", async () => {
    const f = fixture()
    const hooks = await AutoMode(f.input)
    await request(hooks)
    expect(f.replies.map((r) => r.body.response)).toEqual(["once"])
    expect(f.prompts[0].body.agent).toBe(REVIEWER)
    expect(f.prompts[0].body.model).toEqual({ providerID: "openai", modelID: "gpt-6-astra" })
    expect(f.prompts[0].body.tools).toEqual({ "*": false })
    expect(f.creates[0].body.permission).toEqual([{ permission: "*", pattern: "*", action: "deny" }])
    const evidence = JSON.parse(f.prompts[0].body.parts[0].text)
    expect(evidence.tool.args.command).toBe("bun test")
    expect(evidence.recentUserMessages[0].text).toBe("Run local tests.")
    expect(f.deleted).toEqual(["review-1"])
  })
  test("model deny rejects; ask and invalid replies stay pending for the user", async () => {
    for (const [answer, expected] of [
      ['{"decision":"deny","reason":"Exfiltration","confidence":0.99}', ["reject"]],
      ['{"decision":"ask","reason":"Unclear scope","confidence":1}', []],
      ['{"decision":"allow","reason":"Maybe","confidence":0.5}', []],
      ["not json", []],
    ] as const) {
      const f = fixture(async () => ({ data: { info: {}, parts: [{ type: "text", text: answer }] } }))
      await request(await AutoMode(f.input))
      expect(f.replies.map((r) => r.body.response)).toEqual([...expected])
    }
  })
  test("model errors leave the user prompt available", async () => {
    const f = fixture(async () => { throw new Error("Provider offline") })
    await request(await AutoMode(f.input))
    expect(f.replies).toHaveLength(0)
    expect(f.deleted).toEqual(["review-1"])
  })
  test("human replies cancel an in-flight review without a second response", async () => {
    let started!: () => void
    const waiting = new Promise<void>((resolve) => { started = resolve })
    const f = fixture(async ({ signal }) => {
      started()
      await new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("cancelled")), { once: true }))
    })
    const hooks = await AutoMode(f.input)
    const running = request(hooks)
    await waiting
    await emit(hooks, "permission.replied", { sessionID: "main", requestID: "permission-1", reply: "once" })
    await running
    expect(f.replies).toHaveLength(0)
  })
  test("timeouts leave the prompt available", async () => {
    const f = fixture(async ({ signal }) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("timeout")), { once: true })))
    await request(await AutoMode(f.input, { timeoutMs: 100 }))
    expect(f.replies).toHaveLength(0)
  })
  test("times out even if the provider ignores cancellation", async () => {
    const f = fixture(async () => new Promise(() => {}))
    await request(await AutoMode(f.input, { timeoutMs: 100 }))
    expect(f.replies).toHaveLength(0)
  })
  test("never truncates oversized commands into an approval", async () => {
    const f = fixture()
    await request(await AutoMode(f.input), "large", "x".repeat(50_000) + "; dangerous-tail")
    expect(f.prompts).toHaveLength(0)
    expect(f.replies).toHaveLength(0)
  })
  test("missing full arguments stays a user decision", async () => {
    const f = fixture()
    await emit(await AutoMode(f.input), "permission.asked", {
      id: "missing", sessionID: "main", permission: "bash", patterns: ["git status"], metadata: { command: "git status" },
    })
    expect(f.prompts).toHaveLength(0)
    expect(f.replies).toHaveLength(0)
  })
  test("reviewers cannot run tools or recursively review permissions", async () => {
    const f = fixture(async () => {
      await expect(hooks["tool.execute.before"]!({ tool: "bash", sessionID: "review-1", callID: "nested" }, { args: { command: "echo unsafe" } })).rejects.toThrow("cannot execute")
      await emit(hooks, "permission.asked", { id: "nested", sessionID: "review-1", permission: "bash", patterns: [], metadata: {} })
      return { data: { info: {}, parts: [{ type: "text", text: '{"decision":"ask","reason":"Uncertain","confidence":1}' }] } }
    })
    const hooks = await AutoMode(f.input)
    await request(hooks)
    expect(f.prompts).toHaveLength(1)
    expect(f.replies).toHaveLength(0)
  })
  test("concurrent requests are bounded and duplicate events don't trigger duplicate review", async () => {
    let finish!: (value: any) => void
    let started!: () => void
    const waiting = new Promise<void>((resolve) => { started = resolve })
    const f = fixture(async () => { started(); return new Promise((resolve) => { finish = resolve }) })
    const hooks = await AutoMode(f.input, { maxConcurrentReviews: 1 })
    const running = request(hooks)
    await waiting
    await request(hooks)
    await request(hooks, "second")
    expect(f.prompts).toHaveLength(1)
    finish({ data: { info: {}, parts: [{ type: "text", text: '{"decision":"allow","reason":"Scoped","confidence":1}' }] } })
    await running
    expect(f.replies).toHaveLength(1)
  })
  test("rejects malformed configuration", async () => {
    for (const input of [{ model: "no-provider" }, { timeoutMs: -1 }, { minConfidence: 2 }, { maxConcurrentReviews: 0 }]) {
      await expect(AutoMode(fixture().input, input)).rejects.toThrow("Invalid")
    }
  })
})
