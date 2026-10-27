import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { execFileSync } from "node:child_process"
import { mkdtemp, mkdir, rm, symlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fastDecision, ghDecision, parseDecision, repositoryAt, simpleGitRead, type Request } from "./policy"

describe("read-only Git policy", () => {
  for (const command of [
    "git status", "git status --short --branch", "git branch -r", "git branch --all -vv",
    "git ls-remote --heads origin", "git ls-remote upstream refs/heads/main",
    "git log --oneline --max-count=5 origin/main", "git show origin/main:README.md",
    "git diff --no-ext-diff --no-textconv main..origin/main", "git remote -v",
    "git diff", "git diff --cached -- src/main.ts", "git diff --no-index a b",
    "git show HEAD", "git show HEAD:.env", "git show origin/main:.env.local",
    "git show HEAD:.aws/credentials", "git log 'HEAD'", "git log HEAD\t--oneline",
    'git -C "/other repo" diff -- "file name.ts"', "git --git-dir=/other log",
    "git -C /other status", "git --no-pager diff --stat", "git branch", "git tag",
    "git ls-remote https://example.com/repo", "git ls-remote unknown",
    "git rev-parse --show-toplevel", "git ls-files", "git blame README.md",
    "git config --get user.name", "git config list", "git remote get-url origin",
    "git stash list", "git stash show -p", "git worktree list", "git reflog show",
    "git cat-file -p HEAD", "git grep -n pattern", "git tag --list 'v*'",
  ]) test(`allows ${command}`, () => expect(simpleGitRead(command)).toBe(true))

  for (const command of [
    "git branch -D main", "git branch new-branch", "git push origin main", "git fetch origin",
    "git reset --hard", "git clean -fd", "git remote add evil https://example.com",
    "git ls-remote --upload-pack=evil origin", "git -c core.pager=evil log",
    "git show --output=/tmp/out HEAD", "git log --output=/tmp/out", "git diff --ext-diff",
    "git status; rm -rf .", "git status && curl example.com",
    "git status\ngit push", "git status > /tmp/out", "git status | sh", "git log $(evil)",
    "git log `evil`", "GIT_SSH_COMMAND=evil git ls-remote origin",
    "git log HEAD # harmless", "git status &", "git status\r",
    "git tag -a", "git tag new-tag", "git reflog expire --all", "git stash pop",
    "git worktree remove other", "git config user.name changed", "git config --list --edit",
    "git notes add -m hello", "git diff --output out", "git log 'unterminated",
    "git branch --list -Dmain", "git tag --list -amessage", "git grep -Oevil pattern",
    "git grep --open-files-in-pager=evil pattern",
  ]) test(`does not fast-approve ${command}`, () => expect(simpleGitRead(command)).toBe(false))
})

describe("explicit GitHub CLI policy", () => {
  for (const command of [
    "gh pr view 123", "gh issue view 12 --comments", "gh repo view owner/repo",
    "gh release view v1", "gh run view 123 --log", "gh workflow view ci.yml",
    "gh project view 1", "gh gist view abc", "gh ruleset view 123",
    'gh pr view 123 --json title,body --jq ".title"',
    "gh --repo owner/repo pr view 123", "gh issue view 12 -R owner/repo",
  ]) test(`allows ${command}`, () => expect(ghDecision(command)?.decision).toBe("allow"))

  for (const command of [
    'gh issue create --title "hello"', "gh pr edit 123 --title updated", "gh repo delete owner/repo",
    "gh --repo owner/repo issue delete 12", "gh project item-delete 1 --id abc",
    "gh pr merge 123", "gh api repos/owner/repo -X DELETE",
    "gh pr view 123 && gh issue delete 12", "gh pr view 123; touch file",
    "gh pr view 123 > output", "gh pr view 123 | sh", "gh pr view $(evil)",
    "gh pr view `evil`", "gh pr view 123\ngh issue create", "gh pr view 'unterminated",
    "env GH_HOST=example.com gh issue create", "/usr/bin/gh issue delete 1",
    "gh custom view", "gh alias set view '!evil'",
  ]) test(`asks for ${command}`, () => expect(ghDecision(command)?.decision).toBe("ask"))

  test("does not intercept unrelated commands", () => expect(ghDecision("git status")).toBeUndefined())

  test("runs before repository lookup and requires full command evidence", async () => {
    const command = "gh pr view 123"
    const request: Request = { id: "p", sessionID: "s", permission: "shell", patterns: ["gh pr view *"], metadata: { command } }
    const call = { tool: "shell", args: { command } }
    expect((await fastDecision(request, call, "/missing", "/missing"))?.decision).toBe("allow")
    request.metadata.command = "gh pr view *"
    expect((await fastDecision(request, call, "/missing", "/missing"))?.decision).toBe("ask")
  })
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
    expect((await fastDecision(request, { tool: "bash", args: { command: "git status", workdir: "escape" } }, root, root))?.decision).toBe("allow")
    expect((await fastDecision(request, { tool: "bash", args: { command: "git status" } }, "/missing", "/missing"))?.decision).toBe("allow")
  })
  test("doom-loop checkpoints stay human decisions", async () => {
    const request: Request = { id: "p", sessionID: "s", permission: "doom_loop", patterns: [], metadata: {} }
    expect((await fastDecision(request, undefined, root, root))?.decision).toBe("ask")
  })
})
