# 3. The table is generic over its row type and holds no words

Status: accepted
Date recorded: 2026-09-15

## Context

The first version of this table was built around the city dataset. Its type appeared throughout the component, and the strings it rendered were written between its tags. Adding a second dataset would have meant copying it, and translating it would have meant finding every sentence inside it.

## Decision

`DataTable<T, Id>` takes the row type as a parameter. Columns, row identity and every rendered string arrive as props, the strings through a labels object built in the feature layer. Nothing under `src/components/` imports a domain type, the API layer, the data layer or the locale layer.

An entry that weaves a value is a function taking that value, never a phrase composed by the caller. A caller handing over a finished sentence has made a grammatical decision one layer too early, which is what made the old sort summary impossible to translate.

## Consequences

The films page reuses the table unchanged. A reader in any of the four catalogs gets a table with no English left in it.

Four ESLint rules hold the boundary, because two kinds of leak are possible. Two rules watch imports. The other two watch for a sentence between tags and for a hardcoded `aria-label`, `title`, `placeholder` or `alt`, since a literal needs no import and the import rules cannot see one. The `aria-sort` and `aria-live` values are exempt: assistive technology matches on those tokens, so translating them would break the feature rather than localize it.

The cost is indirection. Reading what a button says means following a label prop up into the feature layer.
