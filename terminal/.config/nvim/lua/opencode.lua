local M = {}

-- Find the opencode pane id. Checks current window first, then all windows.
local function find_opencode_pane()
  local handle = io.popen("tmux list-panes -a -F '#{pane_id} #{pane_title}'")
  if not handle then return nil end
  local output = handle:read("*a")
  handle:close()
  for line in output:gmatch("[^\n]+") do
    local pane_id, title = line:match("^(%S+)%s+(.*)$")
    if title and title:match("opencode") then
      return pane_id
    end
  end
  return nil
end

-- Get path relative to git root, fall back to cwd-relative.
local function get_relative_path()
  local abs = vim.fn.expand("%:p")
  if abs == "" then return nil end
  local git_root = vim.fn.systemlist("git rev-parse --show-toplevel")[1]
  if vim.v.shell_error == 0 and git_root and git_root ~= "" then
    -- strip git_root + trailing slash from abs
    if abs:sub(1, #git_root) == git_root then
      return abs:sub(#git_root + 2)
    end
  end
  return vim.fn.fnamemodify(abs, ":.")
end

-- Send text to opencode pane via tmux buffer (reliable for multi-line).
local function send_to_opencode(text)
  local pane = find_opencode_pane()
  if not pane then
    vim.notify("opencode pane not found", vim.log.levels.WARN)
    return
  end
  -- Write to a temp file to avoid shell-escaping headaches
  local tmpfile = vim.fn.tempname()
  local f = io.open(tmpfile, "w")
  if not f then
    vim.notify("failed to create temp file", vim.log.levels.ERROR)
    return
  end
  f:write(text)
  f:close()
  vim.fn.system({ "tmux", "load-buffer", "-b", "nvim-opencode", tmpfile })
  vim.fn.system({ "tmux", "paste-buffer", "-b", "nvim-opencode", "-d", "-t", pane })
  os.remove(tmpfile)
end

-- Normal mode: send "@explainer path:Lcursor"
function M.send_cursor()
  local path = get_relative_path()
  if not path then
    vim.notify("no file path", vim.log.levels.WARN)
    return
  end
  local line = vim.fn.line(".")
  local msg = string.format("@explainer %s:L%d", path, line)
  send_to_opencode(msg)
end

-- Visual mode: send "@explainer path:Lstart-Lend\n<selection>"
function M.send_selection()
  local path = get_relative_path()
  if not path then
    vim.notify("no file path", vim.log.levels.WARN)
    return
  end
  -- Exit visual mode so marks '< and '> are set
  vim.cmd('noautocmd normal! \27')
  local s = vim.fn.getpos("'<")[2]
  local e = vim.fn.getpos("'>")[2]
  local lines = vim.fn.getline(s, e)
  local range = (s == e) and string.format("L%d", s) or string.format("L%d-L%d", s, e)
  local msg = string.format("@explainer %s:%s\n%s", path, range, table.concat(lines, "\n"))
  send_to_opencode(msg)
end

return M
