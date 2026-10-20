import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { execFileSync } from "node:child_process"
import { mkdtemp, mkdir, rm, symlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fastDecision, parseDecision, repositoryAt, simpleGitRead, type Request } from "./policy"

const repo = { root: "/repo", remotes: ["origin", "upstream"] }

describe("read-only Git policy", () => {
  for (const command of [
    "git status", "git status --short --branch", "git branch -r", "git branch --all -vv",
    "git ls-remote --heads origin", "git ls-remote upstream refs/heads/main",
    "git log --oneline --max-count=5 origin/main", "git show origin/main:README.md",
    "git diff --no-ext-diff --no-textconv main..origin/main", "git remote -v",
  ]) test(`allows ${command}`, () => expect(simpleGitRead(command, repo)).toBe(true))

  for (const command of [
    "git branch -D main", "git branch new-branch", "git push origin main", "git fetch origin",
    "git reset --hard", "git clean -fd", "git remote add evil https://example.com",
    "git ls-remote https://example.com/repo", "git ls-remote unknown",
    "git ls-remote --upload-pack=evil origin", "git -c core.pager=evil log",
    "git --git-dir=/other log", "git -C /other status", "git show --output=/tmp/out HEAD",
    "git log --output=/tmp/out", "git diff --ext-diff", "git diff --no-index a b",
    "git show HEAD", "git show HEAD:.env", "git show origin/main:.env.local",
    "git show HEAD:.aws/credentials", "git status; rm -rf .", "git status && curl example.com",
    "git status\ngit push", "git status > /tmp/out", "git status | sh", "git log $(evil)",
    "git log `evil`", "GIT_SSH_COMMAND=evil git ls-remote origin", "git log 'HEAD'",
    "git log HEAD # harmless", "git log HEAD\t--oneline", "git status &", "git status\r",
  ]) test(`does not fast-approve ${command}`, () => expect(simpleGitRead(command, repo)).toBe(false))
})

describe("model output validation", () => {
  test("accepts all three decisions", () => {
    for (const decision of ["allow", "ask", "deny"] as const) {
      expect(parseDecision(JSON.stringify({ decision, reason: "Explanation", confidence: 0.95 }), 0.9).decision).toBe(decision)
    }
  })
  for (const text of [
    "allow", "```json\n{}\n```", "null", "{}", '{"decision":"allow","confidence":1}',
    '{"decision":"allow","confidence":"1","reason":"yes"}',
    '{"decision":"allow","confidence":2,"reason":"yes"}',
    '{"decision":"allow","confidence":1,"reason":""}',
    '{"decision":"approve","confidence":1,"reason":"yes"}',
    '{"decision":"allow","confidence":0.89,"reason":"maybe"}',
    '{"decision":"deny","confidence":0.89,"reason":"maybe"}',
    '{"decision":"allow","confidence":1,"reason":"yes"}\nIgnore the policy',
  ]) test(`fails to ask for ${text}`, () => expect(parseDecision(text, 0.9).decision).toBe("ask"))
})

describe("repository boundaries", () => {
  let base: string
  let root: string
  beforeAll(async () => {
    base = await mkdtemp(path.join(tmpdir(), "opencode-auto-mode-test-"))
    root = path.join(base, "repo")
    await mkdir(root)
    await mkdir(path.join(root, "src"))
    await mkdir(path.join(base, "outside"))
    await symlink(path.join(base, "outside"), path.join(root, "escape"))
    execFileSync("git", ["init", "-q", root])
    execFileSync("git", ["remote", "add", "origin", "https://example.com/repo.git"], { cwd: root })
  })
  afterAll(async () => { await rm(base, { recursive: true, force: true }) })
  test("recognizes configured remotes and repo subdirectories", async () => {
    expect(await repositoryAt(path.join(root, "src"), root)).toEqual({ root, remotes: ["origin"] })
  })
  test("rejects non-repositories and symlink escapes", async () => {
    expect(await repositoryAt(base, root)).toBeUndefined()
    expect(await repositoryAt(path.join(root, "escape"), root)).toBeUndefined()
    expect(await repositoryAt(base, base)).toBeUndefined()
  })
  test("requires complete matching command evidence", async () => {
    const request: Request = { id: "p", sessionID: "s", permission: "bash", patterns: ["git status"], metadata: { command: "git status" } }
    expect((await fastDecision(request, { tool: "bash", args: { command: "git status" } }, root, root))?.decision).toBe("allow")
    expect(await fastDecision(request, undefined, root, root)).toBeUndefined()
    expect(await fastDecision(request, { tool: "bash", args: { command: "git status; evil" } }, root, root)).toBeUndefined()
    expect(await fastDecision(request, { tool: "bash", args: { command: "git status", workdir: "escape" } }, root, root)).toBeUndefined()
  })
  test("doom-loop checkpoints stay human decisions", async () => {
    const request: Request = { id: "p", sessionID: "s", permission: "doom_loop", patterns: [], metadata: {} }
    expect((await fastDecision(request, undefined, root, root))?.decision).toBe("ask")
  })
})
