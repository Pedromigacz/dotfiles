return {
	{
		"chrisgrieser/nvim-early-retirement",
		config = true,
		event = "VeryLazy",
	},
	{
		"eandrju/cellular-automaton.nvim",
		keys = {
			{ "<leader>,fml", "<cmd>CellularAutomaton make_it_rain<CR>", desc = "Make it rain" },
		},
	},
}
