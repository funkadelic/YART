# 16. react-icons is a caret range

Status: accepted
Date recorded: 2026-10-03

## Context

Record 12 exact-pinned `react-icons` as the package's one runtime dependency. A host on any other `react-icons` version then installs a second copy, and an icon fix reaches the host only through a release of this package.

## Decision

The dependency is `^5.5.0`. 5.5.0 is the first release whose typings work without the global JSX namespace React 19 removed. The lockfile still installs one exact version for the repo's own builds.

## Consequences

A host's `react-icons` 5.x satisfies the range, so npm installs one copy.

The package is checked only against the version in the lockfile, not against the floor.

Dependabot's `increase` strategy raises the floor each time it bumps the dependency.

This supersedes the `react-icons` sentence of record 12. Every dev dependency stays an exact pin.
