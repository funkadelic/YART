// Every suite in one process, in a fixed order, which is what the pipeline
// runs. Each suite is a module that registers its benchmarks and runs them as
// it is imported, so a single file can also be run on its own:
//
//   npx tsx bench/sortRows.bench.ts
//
// Awaited imports rather than a plain import list, because the suites have to
// run one after another: two of them measuring at once would each be timed
// against the other's work.

// A dynamic import is not an import declaration, so without this the file is a
// script and a top-level await is an error rather than a module's own.
export {};

await import("./sortRows.bench");
await import("./paginate.bench");
await import("./tableState.bench");
await import("./columns.bench");
await import("./locale.bench");
