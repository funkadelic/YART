import type { AxeResults } from "axe-core";

/**
 * Shared readers over a rule engine result.
 *
 * The formatter is written by hand because a published matcher reports only
 * that some rule failed, which leaves the reader opening a browser to find out
 * which element it was. The strings below carry the rule, its impact, its help
 * URL, and the selector of every offending node, so the console output is enough
 * to start fixing.
 *
 * Both functions are pure and neither registers anything on expect. The
 * assertions stay in the calling test file so they are visible to the
 * renders-against-assertions guard, which reads call sites out of the file it
 * is checking and would count a helper's assertions as belonging to nobody.
 */

/**
 * One readable line per violation, in the order the engine reported them.
 *
 * Callers compare against the empty array, so a failure prints the violations
 * themselves instead of a count of them.
 */
export function describeViolations(results: AxeResults): string[] {
  return results.violations.map((violation) => {
    const nodes = violation.nodes
      .map((node) => {
        const selector = node.target.join(", ");
        const summary = node.failureSummary ?? "no failure summary reported";
        return `    ${selector}\n      ${summary}`;
      })
      .join("\n");

    return [
      `${violation.id} (${violation.impact ?? "no impact reported"}): ${violation.help}`,
      `  ${violation.helpUrl}`,
      nodes,
    ].join("\n");
  });
}

/**
 * The sorted rule ids the engine could not decide, deduplicated.
 *
 * Sorted so the set can be compared to a written-out allowlist without the
 * comparison depending on the order the engine happened to evaluate rules in.
 */
export function incompleteRuleIds(results: AxeResults): string[] {
  return [...new Set(results.incomplete.map((result) => result.id))].sort();
}
