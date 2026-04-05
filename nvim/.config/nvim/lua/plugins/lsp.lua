return {
	{
		"mason-org/mason.nvim",
		build = ":MasonUpdate",
		event = "VeryLazy",
		opts = {
			ui = { border = "single" },
			ensure_installed = {
				"stylua",
			},
		},
		config = function(_, opts)
			require("mason").setup(opts)
			local mr = require("mason-registry")
			mr:on("package:install:success", function()
				vim.defer_fn(function()
					-- trigger FileType event to possibly load this newly installed LSP server
					require("lazy.core.handler.event").trigger({
						event = "FileType",
						buf = vim.api.nvim_get_current_buf(),
					})
				end, 100)
			end)

			mr.refresh(function()
				for _, tool in ipairs(opts.ensure_installed) do
					local p = mr.get_package(tool)
					if not p:is_installed() then
						p:install()
					end
				end
			end)
		end,
	},
	{
		"mason-org/mason-lspconfig.nvim",
		dependencies = {
			{ "mason-org/mason.nvim", opts = {} },
			"neovim/nvim-lspconfig",
		},
		opts = {
			ensure_installed = {
				"tailwindcss",
				"cssls",
				"lua_ls",
				"eslint",
				"bashls",
				"vtsls",
				"tsgo",
				"jsonls",
				"yamlls",
				"bashls",
				"gopls",
				"basedpyright",
				"copilot",
				"cssmodules_ls",
				"css_variables",
				"stylelint_lsp",
			},
			automatic_installation = true,
			automatic_enable = true,
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
		"WhoIsSethDaniel/mason-tool-installer.nvim",
		opts = {
			ensure_installed = { "prettier", "biome", "stylua" },
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
	},
}
