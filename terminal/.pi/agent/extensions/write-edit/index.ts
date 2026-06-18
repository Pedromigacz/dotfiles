import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import edit from "./edit";
import write from "./write";

export default async function (pi: ExtensionAPI) {
  await edit(pi);
  await write(pi);
}
