local M = {}

-- utilities

local function copy_to_clipboard(text)
  local job = vim.fn.jobstart({ "wl-copy" }, { stdin = "pipe" })
  vim.fn.chansend(job, text)
  vim.fn.chanclose(job, "stdin")
end

local function get_current_file_path()
  local abs = vim.fn.expand("%:p")
  if abs == "" then return nil end
  local git_root = vim.fn.systemlist("git rev-parse --show-toplevel")[1]
  if vim.v.shell_error == 0 and git_root and git_root ~= "" then
    if abs:sub(1, #git_root) == git_root then
      return abs:sub(#git_root + 2)
    end
  end
  return vim.fn.fnamemodify(abs, ":.")
end

local function find_opencode_pane()
  local handle = io.popen("tmux list-panes -a -F '#{pane_id} #{window_id} #{pane_title}'")
  if not handle then return nil end
  local output = handle:read("*a")
  handle:close()
  for line in output:gmatch("[^\n]+") do
    local pane_id, window_id, title = line:match("^(%S+)%s+(%S+)%s+(.*)$")
    if title and title:lower():match("opencode") then
      return pane_id, window_id
    end
  end
  return nil, nil
end

local function get_current_window_id()
  return vim.fn.system("tmux display-message -p '#{window_id}'"):gsub("\n", "")
end


local function ensure_opencode_as_pane()
  local oc_pane_id, oc_window_id = find_opencode_pane()
  if not oc_pane_id then
    vim.notify("opencode pane not found in any window", vim.log.levels.WARN)
    return nil
  end

  local current_window_id = get_current_window_id()
  if oc_window_id ~= current_window_id then
    vim.fn.system({ "tmux", "join-pane", "-h", "-l", "20%", "-s", oc_pane_id })
  end

  return oc_pane_id
end

-- actions


-- Send text to opencode pane via tmux buffer.
local function send_to_opencode(text, pane)
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

function M.send_cursor()
  local path = get_current_file_path()
  if not path then
    vim.notify("no file path", vim.log.levels.WARN)
    return
  end

  local pane = ensure_opencode_as_pane()
  if not pane then return end
  local line = vim.fn.line(".")
  local msg = string.format("@explainer %s:L%d", path, line)
  send_to_opencode(msg, pane)
end

function M.send_selection()
  local path = get_current_file_path()
  if not path then
    vim.notify("no file path", vim.log.levels.WARN)
    return
  end

  local pane = ensure_opencode_as_pane()
  if not pane then return end
  vim.cmd('noautocmd normal! \27')
  local s = vim.fn.getpos("'<")[2]
  local e = vim.fn.getpos("'>")[2]
  local lines = vim.fn.getline(s, e)
  local range = (s == e) and string.format("L%d", s) or string.format("L%d-L%d", s, e)

  vim.notify(
    string.format("path: %s\nrange: %s", path, range),
    vim.log.levels.INFO
  )

  local msg = string.format("@explainer %s:%s\n%s", path, range, table.concat(lines, "\n"))
  -- send_to_opencode(msg, pane)
  copy_to_clipboard(msg)
end

return M
