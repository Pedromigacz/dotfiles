return {
  dir = vim.fn.expand("~/.config/plugins/openwings"),
  name = "openwings",
  config = function()
    require("openwings").setup()
  end,
}
