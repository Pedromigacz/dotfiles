local M = {}

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

function M.copy()
  local path = get_current_file_path()
  if not path then
    vim.notify("no file path", vim.log.levels.WARN)
    return
  end

  local mode = vim.fn.mode()
  local is_visual = mode == "v" or mode == "V" or mode == "\22"

  if is_visual then
    vim.cmd("noautocmd normal! \27")
    local s = vim.fn.getpos("'<")[2]
    local e = vim.fn.getpos("'>")[2]
    local lines = vim.fn.getline(s, e)
    local range = (s == e) and string.format("L%d", s) or string.format("L%d-L%d", s, e)
    local ft = vim.bo.filetype
    local fence_open = (ft ~= "" and "```" .. ft) or "```"
    local text = string.format(
      "%s:%s\n%s\n%s\n```",
      path,
      range,
      fence_open,
      table.concat(lines, "\n")
    )
    vim.fn.setreg("+", text)
    vim.notify(string.format("copied: %s:%s", path, range), vim.log.levels.INFO)
  else
    vim.fn.setreg("+", path)
    vim.notify(string.format("copied: %s", path), vim.log.levels.INFO)
  end
end

return M
