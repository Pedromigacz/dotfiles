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
  },
  {
    'saghen/blink.cmp',
    dependencies = { 'rafamadriz/friendly-snippets' },
    version = '1.*',
    opts = {
      keymap = { preset = 'default' },
      appearance = {
        nerd_font_variant = 'mono',
        use_nvim_cmp_as_default = true,
      },
      completion = { documentation = { auto_show = false } },
      signature = { enabled = true },
      fuzzy = { implementation = "prefer_rust_with_warning" }
    },
  }
}
