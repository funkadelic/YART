import { existsSync } from "node:fs";
import { join } from "node:path";

// Resolved from this file's own location rather than from the working directory,
// which is wherever the runner happened to be invoked and is not the project root
// under an IDE runner or an explicit root argument.
const here = import.meta as ImportMeta & { dirname: string };
const projectRoot = join(here.dirname, "..");

/**
 * Refuses the run when there is no build to serve.
 *
 * Called from playwright.config.ts at module scope rather than registered as
 * the runner's own global setup, because that hook is measured to run after the
 * web server rather than before it, which is a minute too late to be this
 * check. The reason sits beside the call.
 *
 * This suite consumes an existing build rather than producing one, so the
 * failure mode it has to buy off is a missing build, and that failure is worse
 * than a refused connection: the preview server starts normally with no build
 * present and serves a 404 at the root, which is not a status the readiness
 * poll accepts. Without this check the run dies a minute later with a message
 * about the web server rather than about the build, which is the difference
 * between a ten second fix and an issue filed about a flaky suite.
 *
 * ponytail: this checks the entry document only, not staleness. A build older
 * than the sources still passes. Compare modification times if that ever bites.
 */
export default function globalSetup(): void {
  if (!existsSync(join(projectRoot, "dist", "index.html"))) {
    throw new Error(
      "dist/index.html is missing. The end-to-end suite serves an existing build. Run: npm run build",
    );
  }
}
