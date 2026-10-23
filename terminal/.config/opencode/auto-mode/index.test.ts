import { expect, test } from "bun:test"
import type { Plugin } from "@opencode/plugin"
import AutoMode from "./index"

async function fixture(options = {}, generate = async () => ({ text: '{"decision":"allow","reason":"Scoped task","confidence":0.99}' })) {
  const hooks: Record<string, (event: any) => Promise<void>> = {}
  const prompts: any[] = []
  const ctx = {
    options: { notify: false, ...options }, location: { project: { directory: "/nonexistent" } },
    tool: { hook: async (name: string, fn: any) => { hooks[name] = fn } },
    permission: { hook: async (name: string, fn: any) => { hooks[name] = fn } },
    session: {
      context: async (): Promise<any[]> => [{ type: "user", id: "u", text: "Run local tests" }],
      get: async () => ({ location: { directory: "/nonexistent" } }),
    },
    generate: { text: async (input: any) => { prompts.push(input); return generate() } },
  }
  const cleanup = await AutoMode.setup(ctx as unknown as Plugin.Context)
  async function request(overrides = {}) {
    await hooks["execute.before"]({ agent: "automode", sessionID: "s", messageID: "m", id: "t", tool: "shell", input: { command: "bun test" } })
    const event = { effect: "ask", agent: "automode", sessionID: "s", action: "shell", resources: ["bun test"], metadata: { command: "bun test" }, source: { type: "tool", messageID: "m", id: "t" }, ...overrides }
    await hooks.evaluate(event)
    return event
  }
  return { hooks, ctx, cleanup, prompts, request }
}

test("V2 hooks approve only automode asks and pass full evidence to tool-free generation", async () => {
  const f = await fixture()
  expect((await f.request()).effect).toBe("allow")
  expect(f.prompts[0].prompt).toContain("bun test")
  expect(f.prompts[0].prompt).toContain("Run local tests")
  expect(f.prompts[0].model).toEqual({ providerID: "openai", id: "gpt-6-astra" })
  for (const override of [{ agent: "build" }, { agent: undefined }, { source: undefined }, { effect: "deny" }, { effect: "allow" }]) await f.request(override)
  expect(f.prompts).toHaveLength(1)
})

test("errors, invalid JSON, low confidence, missing context and checkpoints ask the user", async () => {
  for (const answer of ["bad", '{"decision":"allow","reason":"Unsure","confidence":0.5}']) {
    const f = await fixture({}, async () => ({ text: answer }))
    expect((await f.request()).effect).toBe("ask")
  }
  const f = await fixture({}, async () => { throw new Error("offline") })
  expect((await f.request()).effect).toBe("ask")
  expect((await f.request({ action: "doom_loop" })).effect).toBe("ask")
  f.ctx.session.context = async () => []
  expect((await f.request()).effect).toBe("ask")
})

test("denial is scoped to the evaluated operation", async () => {
  const f = await fixture({}, async () => ({ text: '{"decision":"deny","reason":"Contrary to task","confidence":1}' }))
  expect((await f.request()).effect).toBe("deny")
})

test("resumed calls require matching assistant ownership and recover full input", async () => {
  const f = await fixture()
  f.ctx.session.context = async () => [
    { type: "user", text: "Run local tests" },
    { type: "assistant", id: "old", agent: "automode", content: [{ type: "tool", id: "old-tool", name: "shell", state: { status: "running", input: { command: "bun test --coverage" } } }] },
  ]
  expect((await f.request({ source: { type: "tool", messageID: "old", id: "old-tool" } })).effect).toBe("allow")
  expect(f.prompts[0].prompt).toContain("bun test --coverage")
  expect((await f.request({ source: { type: "tool", messageID: "unknown", id: "unknown" } })).effect).toBe("ask")
})

test("timeouts and cleanup release uncooperative model calls without approving", async () => {
  const f = await fixture({ timeoutMs: 100 }, () => new Promise(() => {}))
  expect((await f.request()).effect).toBe("ask")
  const pending = f.request()
  await new Promise((resolve) => setTimeout(resolve, 10))
  await f.cleanup?.()
  expect((await pending).effect).toBe("ask")
})

test("concurrency limit escalates additional reviews", async () => {
  const f = await fixture({ maxConcurrentReviews: 1, timeoutMs: 100 }, () => new Promise(() => {}))
  const first = f.request()
  await new Promise((resolve) => setTimeout(resolve, 10))
  expect((await f.request()).effect).toBe("ask")
  expect(f.prompts).toHaveLength(1)
  await first
})

test("disabled plugins register no hooks and invalid options fail setup", async () => {
  expect((await fixture({ enabled: false })).hooks).toEqual({})
  await expect(fixture({ minConfidence: 2 })).rejects.toThrow("Invalid auto-mode")
})
