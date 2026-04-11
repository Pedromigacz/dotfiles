return {
  -- main file explorer
  {
    'nvim-mini/mini.nvim',
    config = function()
      require('mini.files').setup()

      vim.keymap.set("n", "<leader>e", function()
        require("mini.files").open()
      end, { desc = "Open mini.files" })
    end,
  },
  -- fallback when needed
  {
    "nvim-neo-tree/neo-tree.nvim",
    branch = "v3.x",
    dependencies = {
      "nvim-lua/plenary.nvim",
      "MunifTanjim/nui.nvim",
      "nvim-tree/nvim-web-devicons",
    },
    lazy = false,
    config = function()
      vim.keymap.set("n", "<leader>E", "<Cmd>Neotree<CR>")
    end,
  }
}
