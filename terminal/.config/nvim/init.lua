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

vim.keymap.set("n", "<leader>oc", function() require("opencode").send_cursor() end,
	{ desc = "Send cursor position to opencode" })
vim.keymap.set("v", "<leader>oc", function() require("opencode").send_selection() end,
	{ desc = "Send selection to opencode" })

vim.keymap.set("n", "<leader>ay", function() require("ai").copy() end,
	{ desc = "Copy file path for AI" })
vim.keymap.set("v", "<leader>ay", function() require("ai").copy() end,
	{ desc = "Copy quote + path for AI" })
vim.keymap.set('n', '<Tab>', ':bnext<CR>')
vim.keymap.set('n', '<S-Tab>', ':bprev<CR>')
vim.keymap.set('n', '<leader>bd', ':bd<CR>')
