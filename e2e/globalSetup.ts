import { existsSync } from "node:fs";
import { join } from "node:path";

// Resolved from this file's own location, because the working directory is
// wherever the runner happened to be invoked and is not the project root under
// an IDE runner or an explicit root argument.
const here = import.meta as ImportMeta & { dirname: string };
const projectRoot = join(here.dirname, "..");

/**
 * Refuses the run when there is no build to serve.
 *
 * Called from playwright.config.ts at module scope. Registering it as the
 * runner's own global setup fails, because that hook is measured to run after
 * the web server starts, a minute too late for this check. The reason sits
 * beside the call.
 *
 * This suite consumes an existing build, so the failure it has to catch is a
 * missing one. The preview server starts normally with no build present and
 * serves a 404 at the root, a status the readiness poll does not accept, so
 * without this check the run dies a minute later with a message about the web
 * server instead of the build. That is the difference between a ten second fix
 * and an issue filed about a flaky suite.
 *
 * ponytail: this checks both entry documents only, not staleness. A build older
 * than the sources still passes. Compare modification times if that ever bites.
 */
export default function globalSetup(): void {
  // Named one at a time, so a build that dropped an entry says which one
  // instead of reporting a count.
  for (const shell of ["index.html", "movies.html"]) {
    if (!existsSync(join(projectRoot, "dist", shell))) {
      throw new Error(
        `dist/${shell} is missing. The end-to-end suite serves an existing build. Run: npm run build`,
      );
    }
  }
}
