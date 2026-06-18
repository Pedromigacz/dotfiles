import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import bash from "./bash";
import omarchySystemTheme from "./omarchy-system-theme";
import vimQuit from "./vim-quit";
import webFetch from "./web-fetch";

export default async function (pi: ExtensionAPI) {
  await bash(pi);
  await omarchySystemTheme(pi);
  await vimQuit(pi);
  await webFetch(pi);
}
