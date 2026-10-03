# 13. The browser floor is native light-dark()

Status: accepted
Date recorded: 2026-10-02

## Context

The floor was Chrome, Edge and Firefox 111 and Safari 16.4. At that floor Lightning CSS cannot leave `light-dark()` in place, so it rewrites each value into a pair of toggle variables that only the stylesheet's own `color-scheme` rules set.

Inside the demo that worked, because the demo sets those rules. Inside a host page it did not. The table ignored the color scheme the host set, and where the host never triggered the toggles, every themed color was invalid.

## Decision

Raise the one floor, `BUILD_TARGET` in `vite.config.ts`, which the app build and the library build share, to Chrome 123, Edge 123, Firefox 120 and Safari 17.5. These are the first versions with native `light-dark()`, so Lightning CSS stops lowering it.

The table then follows whatever `color-scheme` the page sets on the root or on any ancestor, and ships no theme hook.

## Consequences

The demo's floor rises with the package's. Its rule that turns `data-theme` into `color-scheme` keeps working unchanged.

The README's support list changes.

The stated reason for preferring a `[dir="rtl"]` attribute selector over `:dir()` was the old floor, and that reason no longer holds. The rule stays for consistency until it is revisited.

Lowering the floor again would mean shipping a theme hook and documenting an attribute contract for hosts to set, which is the thing this record avoids.
