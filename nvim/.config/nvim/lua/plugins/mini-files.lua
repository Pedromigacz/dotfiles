return {
  {
    'nvim-mini/mini.nvim',
    config = function()
      require('mini.files').setup()

      vim.keymap.set("n", "<leader>e", function()
        require("mini.files").open()
      end, { desc = "Open mini.files" })
    end,
  },
}
