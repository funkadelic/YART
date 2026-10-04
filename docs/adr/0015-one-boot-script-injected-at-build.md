# 15. One boot script, injected into every shell

Status: accepted
Date recorded: 2026-10-04

## Context

Record 1 gave each shell its own copy of the blocking theme and locale script. The resolver modules held a third copy of the constants and the rules. A test parsed all three to hold them in step, and a new shell meant a new copy.

## Decision

The script is one function in `src/bootDocument.ts`, serialized with `Function.prototype.toString` and called with settings built from the resolver modules' exports. A Vite plugin injects it into the head of every shell in dev and build, and the shells carry no inline script.

## Consequences

The constants have one source. Each rule is still written twice, once in its resolver and once in the boot function, and the boot function's unit tests in the gated suite compare the two.

The function must reference nothing outside its own body. A test evaluates the serialized string in global scope to prove it, and the mutation run skips the module because instrumentation breaks the serialized form.

The policy plugin still hashes exactly one inline script, and a host setting its own policy needs that hash.

A third shell gets the script by being a build input, which retires record 1's duplication consequence. The script is now linted like any module under `src/`, which retires record 5's note that it sat outside ESLint.
