# 12. The table is published as an npm package

Status: accepted
Date recorded: 2026-10-02

## Context

The table was adopted by copying files out of `src/`, and the repo had no release tooling. That stance was never written down as a record, so this one supersedes none. Nothing but this repo's own demo consumed the code.

## Decision

`yet-another-react-table` is published from this repo. A library build sits beside the app build: its own Vite config, per-file declarations from `tsc`, ESM only, written into `lib/`, which `dist/` never shares. The package has two exports, the root and the stylesheet.

Two one-time exceptions are recorded here. `src/yart.ts` is the one barrel outside `src/features/<Feature>/index.ts`, and it imports no CSS, so the declarations never carry a stylesheet import; `src/yart.lib.ts` adds the stylesheet for the library build only. The package specifier is the one bare self-reference. It resolves to `src/` through a custom `@yart/source` condition, so dev, the tests and the Pages build need no prebuild. The built-in `development` condition was refused, because a consumer's dev server turns it on and would resolve to a `src/` the consumer does not have.

Releases go through release-please, authenticated as a GitHub App so its pull request runs the required Verify check, which a pull request opened with the workflow token never does. A separate workflow publishes each release through npm trusted publishing over OIDC, with provenance, so no registry token is stored.

The repo's Node floor moves from `engines` to `devEngines`, since `engines` would ship to every consumer. React is a peer dependency. `react-icons` is a dependency on a caret range from 5.5.0, the first release whose typings work without the global JSX namespace React 19 removed, so a host on 5.5 or later shares one copy. Every dev dependency stays an exact pin.

## Consequences

The root exports are a semver contract, so removing one is a major release.

Relative imports in the published graph carry `.js`, because declarations keep their specifiers verbatim and `node16` resolution needs the extension.

Because of the source condition, nothing in dev or test reads the built branch of the exports map. CI therefore packs the package once and checks that tarball with publint, attw and a scratch install that typechecks and renders.

The first version is published by hand, since a trusted publisher can only be attached to a package that already exists, so that one version carries no provenance.
