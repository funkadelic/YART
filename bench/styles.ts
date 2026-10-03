// Preloaded by `npm run bench`, after tsx.

import { registerHooks } from "node:module";

/**
 * Loads every stylesheet as an empty module, since the package entry reaches
 * components that import CSS Modules and Node cannot load them.
 */
registerHooks({
  load(url, context, nextLoad) {
    return /\.s?css$/.test(url)
      ? { format: "module", source: "export default {};", shortCircuit: true }
      : nextLoad(url, context);
  },
});
