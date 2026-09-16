# 1. Two HTML shells instead of a client-side router

Status: accepted
Date recorded: 2026-09-15

## Context

The app shows two datasets, cities and films, on two pages. The usual answer is a router: one shell, one bundle, client-side navigation between routes. The app has no nested views, no route parameters and no navigation guards, so almost none of what a router provides would be used.

Each page also has to stamp the theme and the locale before the first paint, which means a blocking inline script in the HTML. A module cannot do that job, because anything importable runs after the paint it is trying to beat.

## Decision

Ship two HTML entries, `index.html` and `movies.html`, both at the repo root, each with its own inline theme and locale script. `vite.config.ts` names both as build inputs.

## Consequences

Each page is a separate URL, so the two pages cannot collide over the four unprefixed query keys they both use. There is no router dependency and no route table to keep in step with the header links.

The inline script is duplicated, and a copy that drifts would break theming on one page only. `src/toolchain.test.ts` parses both shells and the two modules that hold the same rules, and fails when they stop agreeing.

Adding a third dataset means a third shell and a third copy of that script. That is the point at which a router earns its place.
