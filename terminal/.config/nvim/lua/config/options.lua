vim.opt.clipboard = "unnamedplus"
vim.opt.number = true         -- shows absolute line number on current line
vim.opt.relativenumber = true -- shows relative numbers on all other lines

vim.o.foldlevel = 99
vim.o.foldlevelstart = 99
vim.o.foldenable = true

-- opencode related
vim.o.autoread = true
vim.o.updatetime = 2000
vim.api.nvim_create_autocmd({ "FocusGained", "BufEnter", "CursorHold", "CursorHoldI" }, {
  pattern = "*",
  command = "if mode() !~ '\\v(c|r.?|!|t)' && getcmdwintype() == '' | checktime | endif",
})

-- hide statusbar in favor of lualine config
vim.opt.laststatus = 0
