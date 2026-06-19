#!/usr/bin/env bun
/**
 * pi tool tester — standalone TUI for invoking pi's tools directly.
 *
 * Walking skeleton: discover the real tools a pi session exposes, list them,
 * run a chosen one for real, dump the result, and quit cleanly. No model or API
 * key required.
 *
 *   bun tool-tester/index.ts
 */

import { ProcessTerminal, TUI } from "@earendil-works/pi-tui";
import { initTheme } from "@earendil-works/pi-coding-agent";

import { harvestTools } from "./tool-harvest";
import { ToolTesterApp } from "./tui-app";

async function main(): Promise<void> {
  const cwd = process.cwd();

  initTheme();

  // Discover before taking over the terminal, so any failure prints normally.
  const { tools, dispose } = await harvestTools(cwd);
  if (tools.length === 0) {
    console.error("No tools discovered.");
    process.exitCode = 1;
    return;
  }

  const terminal = new ProcessTerminal();
  const tui = new TUI(terminal);
  const app = new ToolTesterApp(tui, tools, cwd);

  let torndown = false;
  const teardown = () => {
    if (torndown) return;
    torndown = true;
    tui.stop();
    dispose();
  };

  app.onQuit = () => {
    teardown();
    process.exit(0);
  };

  tui.addChild(app);
  tui.setFocus(app);

  // Best-effort cleanup if the process is interrupted at the OS level.
  process.on("SIGINT", () => {
    teardown();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    teardown();
    process.exit(0);
  });

  tui.start();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
