# Decision records

One file per decision that shaped this codebase, written so a reader can see the argument behind the result. Each record says what the situation was, what was chosen, and what that choice costs.

Most of these were made during the build and written down on 2026-09-15, so the dates record when the reasoning was captured rather than when the code landed. A record is not revised when the code changes. A reversal gets a new record that supersedes the old one.

| Record                                          | Decision                                                                               |
| ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| [1](0001-two-html-shells.md)                    | Two HTML shells instead of a client-side router                                        |
| [2](0002-url-holds-the-view-state.md)           | The address holds the view state, written by one component                             |
| [3](0003-domain-free-table.md)                  | The table is generic over its row type and holds no words                              |
| [4](0004-dataset-as-a-fetched-asset.md)         | The dataset ships as a fetched asset, not as an import                                 |
| [5](0005-one-intl-instance-per-locale.md)       | One Intl instance per locale, built in one module                                      |
| [6](0006-coverage-measured-over-jsdom.md)       | The coverage gate is measured over the jsdom suite alone                               |
| [7](0007-tokens-in-dtcg-json.md)                | Design tokens are authored as DTCG JSON                                                |
| [8](0008-no-row-virtualization.md)              | Rows are not virtualized                                                               |
| [9](0009-cold-sort-across-frames.md)            | A cold sort runs across frames, a repeat reuses its order                              |
| [10](0010-one-generic-dataset-page.md)          | One generic page serves both datasets                                                  |
| [11](0011-address-waits-for-a-settled-sort.md)  | The address waits for a sort to reach the screen                                       |
| [12](0012-published-as-an-npm-package.md)       | The table is published as an npm package, released by release-please                   |
| [13](0013-floor-at-native-light-dark.md)        | The browser floor is native light-dark(), so the table follows the page's color scheme |
| [14](0014-prefixed-layered-tokens.md)           | The shipped tokens are prefixed with yart and their defaults are layered               |
| [15](0015-one-boot-script-injected-at-build.md) | One boot script, injected into every shell                                             |

[Front-end practices](../frontend-practices.md) is the survey these sit under: what the repo already does, what it has just adopted, and what it weighed and skipped.
