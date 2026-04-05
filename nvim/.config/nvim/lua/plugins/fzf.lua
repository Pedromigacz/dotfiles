return {
  "ibhagwan/fzf-lua",
  dependencies = { "nvim-tree/nvim-web-devicons" },
  keys = {
  { "<leader>f", group = "find" },
  { "<leader>ff", "<cmd>FzfLua files<cr>",                     desc = "Files" },
  { "<leader>fg", "<cmd>FzfLua live_grep<cr>",                 desc = "Live grep" },
  { "<leader>fb", "<cmd>FzfLua buffers<cr>",                   desc = "Buffers" },
  { "<leader>fr", "<cmd>FzfLua oldfiles<cr>",                  desc = "Recent files" },
  { "<leader>fc", "<cmd>FzfLua commands<cr>",                  desc = "Commands" },
  { "<leader>fR", "<cmd>FzfLua lsp_references<cr>",            desc = "References" },
  { "<leader>fd", "<cmd>FzfLua lsp_definitions<cr>",           desc = "Definitions" },
  { "<leader>fs", "<cmd>FzfLua lsp_document_symbols<cr>",      desc = "Symbols" },
  { "<leader>fC", "<cmd>FzfLua git_commits<cr>",               desc = "Commits" },
  { "<leader>fB", "<cmd>FzfLua git_branches<cr>",              desc = "Branches" },
  { "<leader>fS", "<cmd>FzfLua git_status<cr>",                desc = "Git status" }
  },
  config = function()
require("fzf-lua").setup({
  winopts = {
    height = 0.8,
    width = 0.87,
    row = 0.35,
    col = 0.5,
    border = "rounded",  -- Telescope uses rounded borders
    preview = {
      layout = "vertical",   -- or "horizontal" like Telescope's default
      vertical = "up:45%",   -- preview on top, results on bottom
      -- for horizontal (classic Telescope feel):
      -- layout = "horizontal",
      -- horizontal = "right:50%",
      border = "border",
    },
  },

  -- Telescope-like prompt
  fzf_opts = {
    ["--layout"] = "reverse",        -- prompt at top, results below
    ["--info"] = "inline",
    ["--prompt"] = "   ",           -- Telescope uses a space+arrow style prompt
    ["--pointer"] = " ",
    ["--marker"] = " ",
  },

  -- Styling to match Telescope's highlights
  hls = {
    border      = "TelescopeBorder",
    preview_border = "TelescopeBorder",
    title       = "TelescopeTitle",
    normal      = "TelescopeNormal",
    preview_normal = "TelescopePreviewNormal",
    cursor      = "Cursor",
    search      = "IncSearch",
  },

  -- Match Telescope's keymaps
  keymap = {
    builtin = {
      ["<C-d>"]  = "preview-page-down",
      ["<C-u>"]  = "preview-page-up",
      ["<C-f>"]  = "preview-page-down",
      ["<C-b>"]  = "preview-page-up",
    },
    fzf = {
      ["ctrl-d"] = "preview-page-down",
      ["ctrl-u"] = "preview-page-up",
      ["ctrl-q"] = "select-all+accept",  -- send to quickfix like Telescope
    },
  },

  -- Telescope shows file icons, so match that
  previewers = {
    builtin = {
      syntax          = true,
      syntax_limit_mb = 10,
    },
  },

  files = {
    prompt  = "  Files  ",   -- Telescope-style title in prompt
    git_icons = true,
    file_icons = true,
    color_icons = true,
    fzf_opts = {
      ["--layout"] = "reverse",
    },
  },

  grep = {
    prompt  = "  Grep   ",
    git_icons = true,
    file_icons = true,
  },
})
  end,
}
