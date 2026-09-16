# 2. The address holds the view state, written by one component

Status: accepted
Date recorded: 2026-09-15

## Context

A reader who sorts a table, pages through it and then sends someone the link
expects the recipient to see what they saw. That requires the search term, the
sort column and direction, the page and the page size to live in the address.

Two things go wrong when several components write the address. Their writes
overwrite each other, and `pushState` fills the back stack with positions the
reader never asked to record, so leaving the page costs one press of the back
button per position recorded.

## Decision

The query string carries `q`, `sort`, `page` and `size`, parsed and serialized by
one module. Each page has exactly one writer, the container's effect, and it
calls `replaceState` only. A `popstate` listener in the same component parses the
address back into state. Reads happen at two places per page: the app root for
the search term and the container for the whole state.

## Consequences

Any link opens to the view it describes, and the write is skipped when the
serialized state already equals the current query, so a hand-edited or hostile
link is canonicalized on arrival rather than looping.

The resolved locale is deliberately not in the address. Two readers opening the
same link see the same rows, each in their own language and number format.
Putting the locale in the link would impose the sender's language on whoever
opens it.

The write is wrapped in `try`, because a browser that rate limits history
mutation throws, and a throw in a commit-phase effect would cost the reader the
whole table.

A second writer, or any `pushState`, breaks all of this. Route the change through
the container's state instead.
