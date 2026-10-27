import { execFile } from "node:child_process"
import { realpath } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"

const exec = promisify(execFile)

export type Decision = {
  decision: "allow" | "ask" | "deny"
  reason: string
  confidence: number
}

export type Request = {
  id: string
  sessionID: string
  permission: string
  patterns: string[]
  metadata: Record<string, unknown>
  tool?: { messageID: string; callID: string }
}

export type ToolCall = { tool: string; args: Record<string, unknown> }
export type Repository = { root: string; remotes: string[] }

export const ask = (reason: string): Decision => ({ decision: "ask", reason, confidence: 1 })

export function parseDecision(text: string, threshold: number): Decision {
  try {
    const value = JSON.parse(text.trim())
    if (
      !value || !["allow", "ask", "deny"].includes(value.decision) ||
      typeof value.reason !== "string" || !value.reason.trim() || value.reason.length > 1000 ||
      typeof value.confidence !== "number" || !Number.isFinite(value.confidence) ||
      value.confidence < 0 || value.confidence > 1
    ) return ask("Reviewer returned an invalid decision")
    if (value.decision !== "ask" && value.confidence < threshold) {
      return ask(`Reviewer confidence below ${threshold}: ${value.reason}`)
    }
    return { decision: value.decision, reason: value.reason, confidence: value.confidence }
  } catch {
    return ask("Reviewer did not return a JSON decision")
  }
}

export function inside(root: string, target: string): boolean {
  const relative = path.relative(root, target)
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
}

export async function repositoryAt(cwd: string, worktree: string): Promise<Repository | undefined> {
  try {
    const [realCwd, realWorktree] = await Promise.all([realpath(cwd), realpath(worktree)])
    if (!inside(realWorktree, realCwd)) return
    const options = { cwd: realCwd, timeout: 2000, maxBuffer: 64 * 1024, encoding: "utf8" as const }
    const root = await exec("git", ["rev-parse", "--show-toplevel"], options)
    // Nested repositories are reviewed separately rather than implicitly trusted.
    if (await realpath(root.stdout.trim()) !== realWorktree) return
    const remotes = await exec("git", ["remote"], options)
    return { root: realWorktree, remotes: remotes.stdout.trim().split(/\r?\n/).filter(Boolean) }
  } catch {
    return undefined
  }
}

// Deliberately a tiny language, not a shell parser. Quotes, expansions, pipes,
// redirections, command chains and global git options all go to the reviewer.
export function simpleGitRead(command: string, repo: Repository): boolean {
  if (command.length > 8000 || !/^[a-zA-Z0-9_./:@=,+~^ -]+$/.test(command)) return false
  const [git, subcommand, ...args] = command.trim().split(/ +/)
  if (git !== "git") return false
  const ref = (s: string) => /^[a-zA-Z0-9_][a-zA-Z0-9_./~^@-]*$/.test(s)
  const flagsOnly = (flags: string[]) => args.every((arg) => flags.includes(arg))
  switch (subcommand) {
    case "status":
      return flagsOnly(["--short", "-s", "--branch", "-b", "--porcelain", "--porcelain=v1", "--porcelain=v2", "--untracked-files=no"])
    case "branch":
      return args.length > 0 && flagsOnly(["-r", "--remotes", "-a", "--all", "--list", "--show-current", "-v", "-vv", "--no-color"])
    case "remote":
      return args.length === 0 || (args.length === 1 && args[0] === "-v")
    case "ls-remote": {
      const flags = ["--heads", "--branches", "--tags", "--refs", "--exit-code", "--quiet"]
      let index = 0
      while (flags.includes(args[index])) index++
      return repo.remotes.includes(args[index]) && args.slice(index + 1).every(ref)
    }
    case "log":
      return args.every((arg) => ["--oneline", "--all", "--graph", "--decorate", "--no-decorate", "--no-color"].includes(arg) || /^--max-count=\d+$/.test(arg) || /^-\d+$/.test(arg) || ref(arg))
    case "show":
      // Blob reads don't run external diff/textconv drivers. Commit/patch output
      // is only accepted with both drivers explicitly disabled.
      if (args.length === 1 && /^[a-zA-Z0-9_][a-zA-Z0-9_./~^@-]*:[a-zA-Z0-9_./-]+$/.test(args[0])) {
        return !/(?:^|[/:])(?:\.env(?:\.|$)|\.ssh(?:\/|$)|\.aws(?:\/|$)|credentials(?:[./]|$)|id_rsa|id_ed25519)/i.test(args[0])
      }
      return args.includes("--no-ext-diff") && args.includes("--no-textconv") &&
        args.every((arg) => ["--no-ext-diff", "--no-textconv", "--stat", "--oneline", "--no-color"].includes(arg) || ref(arg))
    case "diff":
      return args.includes("--no-ext-diff") && args.includes("--no-textconv") &&
        args.every((arg) => ["--no-ext-diff", "--no-textconv", "--stat", "--name-only", "--name-status", "--cached", "--staged", "--no-color"].includes(arg) || ref(arg))
    default:
      return false
  }
}

// Explicit GitHub CLI policy. Only built-in view commands are fast-approved;
// other gh operations (including create/edit/delete) remain human decisions.
const ghViewCommands = new Set(["pr", "issue", "repo", "release", "run", "workflow", "project", "gist", "ruleset"])

export function ghDecision(command: string): Decision | undefined {
  if (!/(?:^|[^a-zA-Z0-9_-])gh(?:\s|["']|$)/.test(command)) return
  const manual = ask("GitHub CLI operations other than recognized view commands require user permission (including create/edit/delete)")
  // Accept literal arguments, including quoted JSON/jq arguments, but never
  // expansions, redirects, pipelines, or chained commands as a single read.
  if (command.length > 8000 || /[$`\\\r\n]/.test(command)) return manual
  const tokens = command.match(/"[^"\n]*"|'[^'\n]*'|[^\s"';&|<>()]+/g)
  if (!tokens || tokens.join(" ") !== command.trim().replace(/ +/g, " ")) return manual
  const args = tokens.map((token) => /^["']/.test(token) ? token.slice(1, -1) : token)
  if (args.shift() !== "gh") return manual
  while (args.length) {
    if (["-R", "--repo", "--hostname"].includes(args[0])) {
      args.shift()
      if (!args.shift()) return manual
    } else if (/^(?:--repo|--hostname)=.+$/.test(args[0])) args.shift()
    else break
  }
  if (!ghViewCommands.has(args[0]) || args[1] !== "view") return manual
  return { decision: "allow", reason: `Read-only GitHub CLI pattern: gh ${args[0]} view *`, confidence: 1 }
}

export async function fastDecision(
  request: Request,
  call: ToolCall | undefined,
  directory: string,
  worktree: string,
): Promise<Decision | undefined> {
  // These are deliberate human checkpoints, not ordinary tool authorization.
  if (["doom_loop", "question", "plan_enter", "plan_exit"].includes(request.permission)) {
    return ask("This checkpoint needs the user")
  }
  if (!["bash", "shell"].includes(request.permission) || !call || !["bash", "shell"].includes(call.tool)) return
  const command = call.args.command
  if (typeof command !== "string") return
  // Never authorize a full shell operation from the shortened patterns alone.
  if (request.metadata.command !== command) {
    if (ghDecision(command)) return ask("Full matching GitHub CLI command evidence is required")
    return
  }
  const github = ghDecision(command)
  if (github) return github
  const cwd = typeof call.args.workdir === "string" ? path.resolve(directory, call.args.workdir) : directory
  const repo = await repositoryAt(cwd, worktree)
  if (repo && simpleGitRead(command, repo)) {
    return { decision: "allow", reason: "Read-only Git operation in the current repository", confidence: 1 }
  }
}
