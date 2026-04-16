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
			-- Format synchronously on save, with a timeout
			format_on_save = {
				timeout_ms = 2000,
				lsp_fallback = true,
			},
		},
	}

}
