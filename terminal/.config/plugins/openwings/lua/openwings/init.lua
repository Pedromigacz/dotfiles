local M = {}

M.setup = function(opts)
  vim.keymap.set("n", "<leader>ow", function()
    vim.notify("openwings loaded!", vim.log.levels.INFO, {
      title = "openwings",
    })
  end, { desc = "Openwings test notification" })
end

return M
