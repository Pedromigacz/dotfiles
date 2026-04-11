return {
  {
    "folke/which-key.nvim",
    event = "VeryLazy",
    opts = {
      delay = 800,
      plugins = {
        presets = {
          motions = true
        }
      },
      win = {
        no_overlap = false,
        col = vim.o.columns - 42, -- offset from left = total cols minus popup width
        row = vim.o.lines - 4,
        width = 40,
        border = "rounded",
      },
    },
    keys = {
      {
        "<leader>?",
        function()
          require("which-key").show({ global = false })
        end,
        desc = "Buffer Local Keymaps (which-key)",
      },
    },
  },
}
