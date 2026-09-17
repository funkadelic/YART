// Runs every suite; each also runs alone, e.g. `npx tsx bench/sortRows.bench.ts`.
// Awaited one at a time, because static imports would let the suites overlap.

// Makes the file a module, so top-level await is allowed.
export {};

await import("./sortRows.bench");
await import("./paginate.bench");
await import("./tableState.bench");
await import("./columns.bench");
await import("./locale.bench");
