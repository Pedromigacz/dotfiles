return {
	{
		"stevearc/conform.nvim",
		event = "BufWritePre",
		opts = {
			formatters_by_ft = {
				typescript = { "biome", "prettier", stop_after_first = true },
				typescriptreact = { "biome", "prettier", stop_after_first = true },
				javascript = { "biome", "prettier", stop_after_first = true },
				javascriptreact = { "biome", "prettier", stop_after_first = true },
				json = { "biome", "prettier", stop_after_first = true },
				lua = { "stylua", lsp_format = "prefer" },
			},
			formatters = {
				-- Only use biome in projects that have a biome config,
				-- otherwise fall through to prettier
				biome = {
					require_cwd = true,
				},
			},
			-- Format synchronously on save, with a timeout
			format_on_save = {
				timeout_ms = 2000,
				lsp_fallback = true,
			},
		},
	}

}
