# 11. The address waits for a sort to reach the screen

Status: accepted
Date recorded: 2026-09-30

## Context

A first sort over more than 5,000 rows runs across frames, so the click commits a busy render before the order exists. The page's address effect ran on that commit and wrote `?sort=<column>`. When a column comparator then threw, the failure reached the error boundary with the sort already in the address, and "Show it again" remounted the view from that address and threw again. A reload or a shared link did the same, so the fallback's promise that showing it again may work was false on that path. Smaller sorts throw during render, before any commit, and recover.

Routing the failure into the table's `errorMessage` was rejected, because that region's retry cannot fix a programming error.

## Decision

The table reports, through an optional `onSortSettled` prop, the sort whose order is on screen. The page keeps that sort and skips the address write while the sort in its view state differs from it. The page still has one address writer, and it still calls `replaceState` only. A sort read from the address on mount counts as settled. One restored by back navigation waits like any other, which costs nothing because the address already holds it.

## Consequences

A sort the reader starts that fails across frames never reaches the address, so the reset brings back the view the reader had. Only that path is covered. When the address already names the sort, the reset throws again: a link carrying a throwing sort, or a search or language change that re-sorts a different set under a sort already written. Resetting to an unsorted view would close every path, and it was left for when that matters.

Every sort costs one extra render: the settle report arrives from the table's effect, and the address is written on the render after it. For a sort inside the click that render also runs inside the click. While a large sort runs, the address keeps the previous view, including its page.

This narrows record 2. Its writer now writes only views whose sort has reached the screen.
