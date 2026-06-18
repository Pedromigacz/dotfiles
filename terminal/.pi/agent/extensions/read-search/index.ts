import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import find from "./find";
import grep from "./grep";
import ls from "./ls";
import read from "./read";

export default async function (pi: ExtensionAPI) {
  await find(pi);
  await grep(pi);
  await ls(pi);
  await read(pi);
}
