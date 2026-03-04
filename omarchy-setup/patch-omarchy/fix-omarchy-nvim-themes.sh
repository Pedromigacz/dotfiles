#!/usr/bin/env bash

THEMES_DIR="$HOME/.local/share/omarchy/themes"

patch_theme() {
  local file="$1"
  local content="$2"
  echo "$content" > "$file"
  echo "Patched: $file"
}

# Catppuccin
patch_theme "$THEMES_DIR/catppuccin/neovim.lua" \
'return {
  {
    "catppuccin/nvim",
    name = "catppuccin",
    priority = 1000,
    lazy = false,
    config = function()
      vim.cmd.colorscheme("catppuccin")
    end,
  },
}'

# Catppuccin Latte
patch_theme "$THEMES_DIR/catppuccin-latte/neovim.lua" \
'return {
  {
    "catppuccin/nvim",
    name = "catppuccin",
    priority = 1000,
    lazy = false,
    config = function()
      require("catppuccin").setup({ flavour = "latte" })
      vim.cmd.colorscheme("catppuccin-latte")
    end,
  },
}'

# Ethereal
patch_theme "$THEMES_DIR/ethereal/neovim.lua" \
'return {
  {
    "bjarneo/ethereal.nvim",
    priority = 1000,
    lazy = false,
    config = function()
      vim.cmd.colorscheme("ethereal")
    end,
  },
}'

# Everforest
patch_theme "$THEMES_DIR/everforest/neovim.lua" \
'return {
  {
    "neanias/everforest-nvim",
    priority = 1000,
    lazy = false,
    config = function()
      require("everforest").setup({ background = "soft" })
      vim.cmd.colorscheme("everforest")
    end,
  },
}'

# Flexoki Light
patch_theme "$THEMES_DIR/flexoki-light/neovim.lua" \
'return {
  {
    "kepano/flexoki-neovim",
    priority = 1000,
    lazy = false,
    config = function()
      vim.cmd.colorscheme("flexoki-light")
    end,
  },
}'

# Gruvbox
patch_theme "$THEMES_DIR/gruvbox/neovim.lua" \
'return {
  {
    "ellisonleao/gruvbox.nvim",
    priority = 1000,
    lazy = false,
    config = function()
      vim.cmd.colorscheme("gruvbox")
    end,
  },
}'

# Hackerman
patch_theme "$THEMES_DIR/hackerman/neovim.lua" \
'return {
  {
    "bjarneo/hackerman.nvim",
    dependencies = { "bjarneo/aether.nvim" },
    priority = 1000,
    lazy = false,
    config = function()
      vim.cmd.colorscheme("hackerman")
    end,
  },
}'

# Kanagawa
patch_theme "$THEMES_DIR/kanagawa/neovim.lua" \
'return {
  {
    "rebelot/kanagawa.nvim",
    priority = 1000,
    lazy = false,
    config = function()
      vim.cmd.colorscheme("kanagawa")
    end,
  },
}'

# Matte Black
patch_theme "$THEMES_DIR/matte-black/neovim.lua" \
'return {
  {
    "tahayvr/matteblack.nvim",
    priority = 1000,
    lazy = false,
    config = function()
      vim.cmd.colorscheme("matteblack")
    end,
  },
}'

# Nord
patch_theme "$THEMES_DIR/nord/neovim.lua" \
'return {
  {
    "EdenEast/nightfox.nvim",
    priority = 1000,
    lazy = false,
    config = function()
      vim.cmd.colorscheme("nordfox")
    end,
  },
}'

# Osaka Jade
patch_theme "$THEMES_DIR/osaka-jade/neovim.lua" \
'return {
  {
    "ribru17/bamboo.nvim",
    priority = 1000,
    lazy = false,
    config = function()
      vim.cmd.colorscheme("bamboo")
    end,
  },
}'

# Ristretto
patch_theme "$THEMES_DIR/ristretto/neovim.lua" \
'return {
  {
    "gthelding/monokai-pro.nvim",
    priority = 1000,
    lazy = false,
    config = function()
      require("monokai-pro").setup({
        filter = "ristretto",
        override = function()
          return {
            NonText = { fg = "#948a8b" },
            MiniIconsGrey = { fg = "#948a8b" },
            MiniIconsRed = { fg = "#fd6883" },
            MiniIconsBlue = { fg = "#85dacc" },
            MiniIconsGreen = { fg = "#adda78" },
            MiniIconsYellow = { fg = "#f9cc6c" },
            MiniIconsOrange = { fg = "#f38d70" },
            MiniIconsPurple = { fg = "#a8a9eb" },
            MiniIconsAzure = { fg = "#a8a9eb" },
            MiniIconsCyan = { fg = "#85dacc" },
          }
        end,
      })
      vim.cmd.colorscheme("monokai-pro")
    end,
  },
}'

# Rose Pine
patch_theme "$THEMES_DIR/rose-pine/neovim.lua" \
'return {
  {
    "rose-pine/neovim",
    name = "rose-pine",
    priority = 1000,
    lazy = false,
    config = function()
      vim.cmd.colorscheme("rose-pine-dawn")
    end,
  },
}'

# Tokyo Night
patch_theme "$THEMES_DIR/tokyo-night/neovim.lua" \
'return {
  {
    "folke/tokyonight.nvim",
    priority = 1000,
    lazy = false,
    config = function()
      vim.cmd.colorscheme("tokyonight-night")
    end,
  },
}'

echo "All themes patched."
