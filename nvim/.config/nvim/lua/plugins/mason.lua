return {
  {
    "mason-org/mason.nvim",
    opts = {}
  },
  {
    "mason-org/mason-lspconfig.nvim",
    dependencies = {
      { "mason-org/mason.nvim", opts = {} },
      "neovim/nvim-lspconfig",
    },
    opts = {
      handlers = {
        function(server_name)
          require('lspconfig')[server_name].setup({
            capabilities = require('blink.cmp').get_lsp_capabilities(),
          })
        end,
      },
    },
  }
}
