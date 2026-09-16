# 8. Rows are not virtualized

Status: accepted
Date recorded: 2026-09-15

## Context

The dataset is 50,250 rows and virtualization is the expected answer for a large
table. It is also the feature that most often arrives before it is needed,
bringing scroll restoration bugs, broken keyboard navigation, print output that
stops after a screenful, and a find-in-page that only searches what is rendered.

Pagination already bounds the DOM here. The largest page size renders 100 rows,
which is a table any browser handles.

## Decision

Render every row on the current page and offer no way to render them all. Sort
and filter still run over the full dataset, so the reader is choosing how much to
show, not how much the app looks at.

## Consequences

Keyboard navigation, find-in-page and printing all work on what is displayed,
with no code of ours in the way.

There is no "show all" mode, and a page size in the thousands would put that many
rows in the DOM, so the offered page sizes are the ceiling.

`Column.width` exists and nothing sets it. It is declared for the virtualizer
this decision defers, which needs a width before it measures a row.

Revisit when a reader needs an unbounded view, or when a page size
past a few hundred is wanted. At that point the work is a virtualizer over the
table body, and the accessibility cost above is the part to budget for.
