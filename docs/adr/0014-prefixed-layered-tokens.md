# 14. The shipped tokens are prefixed and layered

Status: accepted, superseded in part by [15](0015-forced-colors-remap-outside-the-layer.md)
Date recorded: 2026-10-02

## Context

The stylesheets read about thirty custom properties named for their family alone, such as `--radius-sm` and `--space-4`. Inside a host those names collide. Tailwind v4 declares `--radius-sm` and `--radius-md` in its theme layer, so an unlayered `:root` block from the table would silently override the host's values.

## Decision

Style Dictionary's `prefix` option names every token `--yart-*`. The DTCG source in `tokens/` is unchanged.

The defaults ship inside `@layer yart`, so any unlayered host rule wins without a specificity contest.

The forced-colors remap ships in the same layer, after the defaults. It is the table's accessibility guarantee, not the demo's, so it travels with the table.

Component rules stay unlayered. A layered rule would lose to a host's element reset, which is usually unlayered.

The custom properties are the contract. The generated class names, `yart-<Component>__<class>`, are best-effort and may change.

## Consequences

Renaming a token after the first publish breaks every host override that sets it, so the names are one-way.

Hosts set `color-scheme` to pick light or dark, and draw their own focus ring, since the table cancels no outline.

The token guard fails on any stylesheet still reading a bare name.

This extends record 7.
