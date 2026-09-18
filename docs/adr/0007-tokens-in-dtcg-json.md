# 7. Design tokens are authored as DTCG JSON

Status: accepted
Date recorded: 2026-09-15

## Context

The tokens were hand-written CSS custom properties: a light block and a dark block that overrode part of it. Nothing tied the two together, so a color added to one and forgotten in the other was caught by a test rather than by the file itself.

The Design Tokens Community Group format reached a stable release in October 2025, and Style Dictionary builds from it. The format exists for interchange, so its value shows up when tokens cross a boundary, between a design tool and code, or between platforms. This app has one platform and one consumer, so that part does not apply here.

## Decision

Author the tokens as DTCG JSON in `tokens/`: `base.tokens.json` for the primitives, spacing, type, radii and the two logo colors, plus `light.tokens.json` and `dark.tokens.json` for the eleven colors that follow the theme. Build `src/styles/tokens.css` from them with Style Dictionary and commit the result.

Colors are sRGB component objects, which the format requires, each carrying the optional `hex` fallback so the file stays readable. Dimensions are value and unit objects. Each group declares its `$type` once and its tokens inherit it.

## Consequences

The build merges the two theme files into one `light-dark()` value per color, so both themes come from one source and the stylesheet no longer repeats itself. It refuses to run when the two theme files name different colors, which is the check the old two-block CSS could not make.

Style Dictionary reads a `hex` fallback only for colors outside the sRGB range, so one that disagreed with its components would sit there unnoticed. The build compares every declared hex against the value the components produce and fails when they differ.

`src/theme/tokens.build.test.ts` regenerates the stylesheet and fails when the committed file drifts from the JSON, so the JSON and the shipped CSS cannot diverge.

The cost is indirection and verbosity. `#fbfbfc` became an object, reading a color now means reading JSON rather than CSS, and the pipeline is a dependency and a build script that a hand-written stylesheet did not need. For an app of this size that trade is not obviously worth it; what pays for it here is the single source for both themes and the drift guard.

There is no resolver file. The DTCG resolver module expresses themes declaratively, but Style Dictionary cannot read one, so it would be a file that describes the build without driving it.
