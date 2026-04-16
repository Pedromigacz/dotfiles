return {
  -- main file explorer
  {
    'nvim-mini/mini.nvim',
    config = function()
      require('mini.files').setup()

      vim.keymap.set("n", "<leader>e", function()
        local mf = require("mini.files")
        local buf_path = vim.api.nvim_buf_get_name(0)
        local git_root = vim.fn.systemlist("git rev-parse --show-toplevel")[1]
        local root = (vim.v.shell_error == 0 and git_root) or vim.uv.cwd()

        if buf_path == "" then
          mf.open(root)
          return
        end

        -- Count how many levels between git root and the file's directory
        local levels = 0
        local current = vim.fn.fnamemodify(buf_path, ":h")
        while current ~= root do
          local parent = vim.fn.fnamemodify(current, ":h")
          if parent == current then break end -- reached fs root, bail
          levels = levels + 1
          current = parent
        end

        -- Open focused on the file, then navigate out to root
        mf.open(buf_path)
        vim.defer_fn(function()
          for _ = 1, levels do
            mf.go_out()
          end
        end, 50)
      end)

      vim.api.nvim_create_autocmd("User", {
        pattern = "MiniFilesBufferCreate",
        callback = function(args)
          local mf = require("mini.files")

          -- Find git root from cwd
          local git_root = vim.fn.systemlist("git rev-parse --show-toplevel")[1]
          if vim.v.shell_error ~= 0 then return end -- not a git repo, leave h alone

          vim.keymap.set("n", "h", function()
            local current = mf.get_fs_entry()
            if not current then return end

            -- Get the parent of the currently visible directory
            local dir = vim.fn.fnamemodify(current.path, ":h")
            local parent = vim.fn.fnamemodify(dir, ":h")

            if dir == git_root or parent == git_root and dir == git_root then
              return -- already at root, block going further
            end

            mf.go_out()
          end, { buffer = args.data.buf_id })
        end,
      })
    end,
  },
  -- fallback when needed
  {
    "nvim-neo-tree/neo-tree.nvim",
    branch = "v3.x",
    dependencies = {
      "nvim-lua/plenary.nvim",
      "MunifTanjim/nui.nvim",
      "nvim-tree/nvim-web-devicons",
    },
    lazy = false,
    config = function()
      vim.keymap.set("n", "<leader>E", "<Cmd>Neotree<CR>")
    end,
  }
}
