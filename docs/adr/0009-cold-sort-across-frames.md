# 9. A cold sort runs across frames, a repeat reuses its order

Status: accepted
Date recorded: 2026-09-16

## Context

`e2e/latency.spec.ts` held every interaction to 200 ms or less except sorting, which had a 1,000 ms budget. Hosted runners measured 392 to 624 ms for a click on a column header, and a local run measured a 336 ms median at the spec's fourfold processor slowdown.

A CPU profile of that click put 324 of its 338 ms inside `sortRows` and about 5 ms in rendering and committing the sorted page. Sorting 50,250 cities by name makes 715,418 comparisons, and in Node the collator's `compare` took 43.5 ms of a 57 ms sort. All of it ran inside the click.

## Decision

The last order produced for each column and direction is kept, keyed on the column object. The container rebuilds its columns when the language changes, so a new locale is a new key and never gets another locale's order. Each direction is sorted on its own. Reversing an ascending order would move blanks to the front and flip the identity tiebreak within equal values, which the shared comparator exists to prevent.

The table sorts rows the container has already filtered, so a lookup has to handle a set that differs from the one stored. When the stored order covers every row passed in, the rows come back as that order filtered down to them. That is correct because the comparator and the identity tiebreak form a total order. When the stored order does not cover them, the rows are sorted again and replace the entry.

A set over 5,000 rows with no stored order is sorted by a merge sort that yields to the browser about every 8 ms, through `scheduler.yield` where it exists and `setTimeout` elsewhere. Meanwhile the table keeps the previous order on screen and sets the same `aria-busy` state a refetch uses. The sort announcement and the result count wait until the new order is showing. Sets of 5,000 rows or fewer still sort inside the click, which covers a one-word search such as `san` at 1,701 rows.

Two alternatives were rejected. Precomputed sort keys need a key per row, and JavaScript has no API that turns a collator into one, so building the keys costs the same full collator sort. Keys also cannot be derived for a column that supplies its own comparator. A Web Worker would copy the rows across a thread boundary, and structured-cloning the 50,250 rows took 180 ms at fourfold slowdown before any sorting started. Column comparators are closures over the collator and cannot be sent to a worker, so a worker would also need columns described as data.

## Consequences

At fourfold slowdown the median sort click is 16 ms with a stored order and 32 ms without one, down from 336 ms. The sort budget dropped from 1,000 ms to 200 ms, the floor the other interactions use. The spec gates the cold click on its own, and also the time from a cold click to sorted rows on screen, which has a 409 ms median (387 to 528) against a 1,300 ms budget.

A cold sort finishes later than the blocking pass it replaced, 387 to 528 ms against 352 to 400 ms in a separate local run, because each yield adds time. Until it finishes the reader sees the old order marked busy. A link that arrives already sorted shows the loading text until the first pass settles, since there is no earlier order to show.

Each column and direction a reader sorts keeps two arrays of row references alive, the rows it was given and their order, for as long as its column array exists. The first sort of each still compares every row. The 5,000-row threshold is scaled from the full-set measurement rather than measured at 5,000. Browsers without `scheduler.yield` pay the 4 ms minimum delay on nested timers at each yield.

A long-animation-frame entry of about 100 ms still appears during a cold sort. Its blocking duration is zero. The slices run back to back with nothing to render between them, and a click on the next page during the sort measured 16 ms.

Revisit when a dataset grows until the slices add up to seconds. A worker that owns the dataset and returns row ids would avoid the copy, and it has not been measured.
