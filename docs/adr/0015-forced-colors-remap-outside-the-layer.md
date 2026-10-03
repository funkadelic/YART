# 15. The forced-colors remap sits outside the layer

Status: accepted
Date recorded: 2026-10-03

## Context

Record 14 put the forced-colors remap in `@layer yart`, after the token defaults. The README tells hosts to override a token with an unlayered `:root` rule, and an unlayered declaration beats a layered one. So under forced colors, every token a host had overridden kept the host's color instead of the system one.

## Decision

The remap leaves the layer and becomes an unlayered rule on `:root:root`. The doubled selector outranks a host's plain `:root` override whichever stylesheet loads last.

`!important` was refused. It would beat every host rule, including one a host writes on purpose to restyle forced colors itself.

## Consequences

A host rule more specific than `:root:root`, or a token set on an element below the root, still wins under forced colors. The README says so.

The token tests and the package smoke fail if the remap returns to the layer.

This supersedes the remap paragraph of record 14. Its token defaults stay layered.
