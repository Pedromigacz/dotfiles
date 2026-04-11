require("config.lazy")
require("config.options")

local autocmd = vim.api.nvim_create_autocmd

-- Save session on exit
autocmd("VimLeavePre", {
  callback = function()
    vim.cmd("mksession! .session.vim")
  end,
})

-- Restore session if one exists in the current directory
autocmd("VimEnter", {
  nested = true,
  callback = function()
    if vim.fn.argc() == 0 and vim.fn.filereadable(".session.vim") == 1 then
      vim.cmd("source .session.vim")
    end
  end,
})
