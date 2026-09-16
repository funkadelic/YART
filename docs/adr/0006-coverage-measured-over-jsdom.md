# 6. The coverage gate is measured over the jsdom suite alone

Status: accepted
Date recorded: 2026-09-15

## Context

Three suites run in CI: the jsdom unit and component tests, an accessibility sweep in a real browser, and an end-to-end run against a production build. The coverage gate is a hard 100%, which fails the build rather than recording a number in a log nobody reads.

Coverage from several runners can be merged, and merging only ever raises the number. That sounds harmless. Merging puts the floor on the slowest and most engine-dependent suite in the tree, so a flaky browser run becomes a coverage failure and the way to close a gap becomes "add an end-to-end test."

## Decision

Measure the gate over the jsdom project only. The end-to-end runner collects no coverage at all.

## Consequences

A gap has to be closed by a fast test, which is the kind worth having. The browser suites are free to assert what only a real engine can decide, without their line counts meaning anything.

The carve rests on `test:coverage` being the only script that asks for coverage and on it naming the jsdom project. Nothing fails if a coverage flag is added to the end-to-end script, so that flag would quietly emit a second report into the directory the Sonar import reads.

Two exclusion lists describe the same set in two dialects, one for the coverage provider and one for Sonar. `src/toolchain.test.ts` derives the second from the first and fails on any drift, because divergence there shows up as a gate that cannot be reached rather than as an error.
