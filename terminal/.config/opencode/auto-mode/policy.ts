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

// Literal shell arguments only. Compound operations still need whole-operation review.
export function simpleGitRead(command: string): boolean {
  if (command.length > 8000 || /[$`\\\r\n]/.test(command)) return false
  const tokens = command.match(/"[^"\n]*"|'[^'\n]*'|[^\s"';&|<>()#]+/g)
  if (!tokens || tokens.join(" ") !== command.trim().replace(/[ \t]+/g, " ")) return false
  const args = tokens.map((token) => /^["']/.test(token) ? token.slice(1, -1) : token)
  if (args.shift() !== "git") return false
  while (args.length) {
    if (["-C", "--git-dir", "--work-tree", "--namespace"].includes(args[0])) {
      args.shift()
      if (!args.shift()) return false
    } else if (/^--(?:git-dir|work-tree|namespace)=.+$/.test(args[0]) ||
      ["--no-pager", "--paginate", "-P", "-p", "--no-optional-locks", "--literal-pathspecs", "--no-replace-objects"].includes(args[0])) args.shift()
    else break
  }
  const subcommand = args.shift()
  const options = args.slice(0, args.includes("--") ? args.indexOf("--") : args.length)
  // Read commands can also write output or invoke explicitly supplied programs.
  if (options.some((arg) => /^--(?:output|ext-diff|textconv|exec|upload-pack|receive-pack|open-files-in-pager)(?:=|$)/.test(arg))) return false
  if (subcommand === "grep" && options.some((arg) => /^-O/.test(arg))) return false
  if (["status", "diff", "show", "log", "shortlog", "reflog", "rev-parse", "rev-list",
    "ls-files", "ls-tree", "ls-remote", "show-ref", "show-branch", "describe", "blame",
    "annotate", "grep", "cat-file", "diff-files", "diff-index", "diff-tree", "merge-base",
    "name-rev", "count-objects", "cherry", "whatchanged", "range-diff", "verify-commit",
    "verify-tag", "check-ignore", "check-attr", "check-ref-format", "version", "help"].includes(subcommand ?? "")) {
    if (subcommand === "reflog" && options.some((arg) => ["delete", "drop", "expire", "write"].includes(arg))) return false
    return true
  }
  switch (subcommand) {
    case "branch":
    case "tag":
      if (subcommand === "tag" && options.some((arg) => arg.startsWith("-a") || arg.startsWith("--annotate"))) return false
      if (options.some((arg) => /^-[dDmMcCfsu]/.test(arg) || /^--(?:delete|move|copy|force|edit-description|set-upstream-to|unset-upstream|create-reflog|sign|annotate|message|file)(?:=|$)/.test(arg))) return false
      return args.length === 0 || options.includes("--list") || options.includes("-l") ||
        options.every((arg) => ["-r", "--remotes", "-a", "--all", "--show-current", "-v", "-vv", "--no-color"].includes(arg))
    case "remote":
      return args.length === 0 || args.every((arg) => ["-v", "--verbose"].includes(arg)) ||
        ["show", "get-url"].includes(args[0])
    case "stash":
      return ["list", "show"].includes(args[0])
    case "worktree":
      return args[0] === "list"
    case "config":
      return ["get", "list"].includes(args[0]) || options.some((arg) => ["--get", "--get-all", "--get-regexp", "--get-urlmatch", "--list", "-l"].includes(arg)) &&
        !options.some((arg) => /^--(?:unset|unset-all|replace-all|add|rename-section|remove-section|edit)(?:=|$)/.test(arg) || arg === "-e")
    case "notes":
      return args.length === 0 || ["list", "show"].includes(args[0])
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
  if (simpleGitRead(command)) {
    return { decision: "allow", reason: "Read-only Git operation", confidence: 1 }
  }
}
