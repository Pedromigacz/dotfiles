local M = {}

local default_opts = {
  direction = "h", -- "h" for horizontal, "v" for vertical
  size = "20%",
}

M.setup = function(opts)
  opts = vim.tbl_deep_extend("force", default_opts, opts or {})

  vim.keymap.set("n", "<leader>ot", function()
    local panes = vim.fn.system("tmux list-panes -F '#{pane_id} #{pane_title}'")
    local pane_id = nil
    for id, title in panes:gmatch("(%%[%d]+) ([^\n]+)") do
      if title:find("OpenCode") then
        pane_id = id
        break
      end
    end

    if pane_id then
      -- OpenCode is a pane, send it back to its own window
      local session = vim.fn.system("tmux display-message -p '#S'"):gsub("\n", "")
      local window = vim.fn.system("tmux display-message -p '#I'"):gsub("\n", "")
      vim.fn.system("tmux break-pane -d -s " .. session .. ":" .. window .. "." .. pane_id .. " -n opencode")
    else
      -- OpenCode is a window, pull it in as a pane
      local flag = opts.direction == "v" and "-v" or "-h"
      vim.fn.system("tmux join-pane " .. flag .. " -l " .. opts.size .. " -s opencode")
    end
  end, { desc = "Toggle opencode pane" })
end
return M
-- tmux break-pane -d -s main:1.%1 -n opencode
