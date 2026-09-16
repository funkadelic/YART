# Decision records

One file per decision that shaped this codebase, written so a reader can see the
argument behind the result. Each record says what the situation was, what was
chosen, and what that choice costs.

Most of these were made during the build and written down on 2026-09-15, so the
dates record when the reasoning was captured rather than when the code landed.
A record is not revised when the code changes. A reversal gets a new record that
supersedes the old one.

| Record                                    | Decision                                                   |
| ----------------------------------------- | ---------------------------------------------------------- |
| [1](0001-two-html-shells.md)              | Two HTML shells instead of a client-side router            |
| [2](0002-url-holds-the-view-state.md)     | The address holds the view state, written by one component |
| [3](0003-domain-free-table.md)            | The table is generic over its row type and holds no words  |
| [4](0004-dataset-as-a-fetched-asset.md)   | The dataset ships as a fetched asset, not as an import     |
| [5](0005-one-intl-instance-per-locale.md) | One Intl instance per locale, built in one module          |
| [6](0006-coverage-measured-over-jsdom.md) | The coverage gate is measured over the jsdom suite alone   |
| [7](0007-tokens-in-dtcg-json.md)          | Design tokens are authored as DTCG JSON                    |
| [8](0008-no-row-virtualization.md)        | Rows are not virtualized                                   |

The practices this repo weighed and chose not to adopt are in
[front-end practices](../frontend-practices.md).
