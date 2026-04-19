return {
	{
		"nvim-lualine/lualine.nvim",
		event = "VeryLazy",
		config = function()
			require('lualine').setup({
				tabline = {
					lualine_a = { 'mode', },
					lualine_b = {
						'buffers',
					},
					lualine_y = { 'lsp_status' },
					lualine_z = { 'location' },
				},
				sections = {}, -- disable the bottom statusline
				inactive_sections = {},
				options = {
					section_separators = { left = '', right = '' },
					component_separators = { left = '', right = '' },
				},
			})
		end,
	},
}
