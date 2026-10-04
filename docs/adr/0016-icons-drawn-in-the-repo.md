# 16. The icons are drawn in the repo

Status: accepted
Date recorded: 2026-10-04

## Context

Record 12 made the icon library a runtime dependency on a caret range from 5.5.0, so a host shared one copy. The table draws seven glyphs: search, sort up, sort down, and the four page controls.

## Decision

The seven glyphs are inline SVG components in `src/components/icons.tsx`, drawn from strokes authored here. They keep the old rendering contract (a 24 unit view box, one em square, `currentColor`) and add `focusable="false"`. The library is removed.

This supersedes the icon-library sentence of record 12 and nothing else in it.

## Consequences

The package's only runtime dependency is gone, leaving the React peer. The 5.5.0 floor and its typings note go with it.

The glyphs are strokes where the Material set was filled, so the page controls read slightly lighter and the Chromatic baselines change.

A new glyph is a new component in that file. The paths are original, so no third-party icon license ships.
