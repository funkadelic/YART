# Recovery notes

This working tree was rebuilt from the remains of a damaged local git
repository. The original clone lost its `refs/` directory and its packfile, so
neither the branch history nor most of the tracked blobs could be read. What
follows is where each file came from, so nothing here is mistaken for the
original submission.

## Recovered byte for byte

Restored from surviving loose objects, identical to the last commit
(`547e19a`, "feat: make sure search input is still visible when there is an
error"):

- `src/components/SortableTable.tsx`

## Recovered from an earlier revision

The final blobs were lost, so these come from the newest surviving version of
the same file. They are the author's own code, just one or more commits behind
the tip:

- `src/App.tsx` (unused `useMemo` import removed so lint passes)
- `src/components/SortableTable.test.tsx`
- `src/components/SortableTable.module.scss` (defines every class the final
  component references)
- `src/hooks/useDebounce.ts`

## Rewritten from scratch

No copy of these survived. They are reconstructions that match the interfaces
the recovered code expects, not the originals:

- `src/api/getCities.ts` and `src/api/getCities.test.ts`
- `src/data/worldcities/cities.ts` (see `src/data/worldcities/license.txt`; the
  original was the full simplemaps world cities export, roughly 44k rows, and
  this stand-in holds 162 major cities with approximate populations)
- `src/features/Header`, `src/features/Footer`, `src/features/RootLayout`
- `src/index.tsx`, `src/index.css`, `src/logo.svg`, `src/setupTests.ts`
- `src/App.test.tsx`
- `public/manifest.json`, `public/robots.txt`
- `.github/CODEOWNERS`, `.github/dependabot.yml`, `.husky/pre-commit`

## Lost

- The commit history. Ancestor objects are gone, so this repository starts from
  a fresh initial commit. The old reflog survives in the salvaged git directory
  if the commit subjects are useful.
- `public/favicon.ico`, `public/logo192.png`, `public/logo512.png`. Binary
  assets with no surviving copy.
- The uncommitted work in progress that was stashed after the last commit.

## Verified after rebuild

`npx tsc --noEmit`, `npm run lint`, `npm test` (40 tests), and `npx vite build`
all pass.

## Salvage material

The damaged git directory and one stray file were moved to a sibling directory
suffixed `-salvage`, outside this repository:

- `broken.git` still holds the loose objects and the original reflogs, so the
  old commit subjects, SHAs, and timestamps remain readable even though the
  trees they point at are gone.
- `SortableTable.test.tsx.alt` is a newer, never-committed copy of the
  component test. It was written against a later component variant and does
  not pass against the code here.
