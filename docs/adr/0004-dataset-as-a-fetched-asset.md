# 4. The dataset ships as a fetched asset, not as an import

Status: accepted
Date recorded: 2026-09-15

## Context

The cities dataset is 3.3 MB of JSON and the films dataset is 1.2 MB. Importing
either one for its value compiles it into the JavaScript chunk, where it is
parsed before the app can render anything. Nothing reports this, and the build
succeeds with the bundle several megabytes larger.

## Decision

Import each dataset for its URL and fetch it at runtime, so the bundler emits it
as a content-hashed asset. The data module validates the payload, indexes it for
search, and holds one module-scope promise so a double mount issues one request.
`src/bundle.test.ts` fails if a value import comes back.

## Consequences

The app shell loads without waiting for the data, and the browser caches the
dataset under its content hash across deploys that do not change it.

Failure becomes a state the UI has to handle, so the loader throws a typed error
carrying a code and a numeric detail at each transport, status and parse
boundary. The reader-facing sentence is chosen from that code during render,
not in the fetch effect, so a language change does not re-issue the request.

The promise cache is cleared on rejection, which is what makes the retry button
work. Each dataset has its own cache, so one cannot answer the other's request.
