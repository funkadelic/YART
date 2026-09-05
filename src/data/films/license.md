# Films dataset: license verdict

This file is authored by this project, unlike `src/data/worldcities/license.txt`, which is a document
the upstream supplier ships. Wikidata ships no per-export license file, so the verdict is written
here instead.

## Verdict

The Wikidata export in `src/data/films/films.json` is CC0. It may be committed to a public
repository, redistributed, and regenerated. No attribution is required.

## The policy, quoted

From [Wikidata:Copyright](https://www.wikidata.org/wiki/Wikidata:Copyright):

> All structured data from the main, Property, Lexeme, and EntitySchema namespaces is available under
> the Creative Commons CC0 License; text in the other namespaces is available under the Creative
> Commons Attribution-ShareAlike License.

From [Wikidata:Data access](https://www.wikidata.org/wiki/Wikidata:Data_access):

> We offer the data in Wikidata freely and with no requirement for attribution under CC-0. In return,
> we would greatly appreciate it if, in your project, you mention Wikidata as the origin of your
> data.

Every property the recorded query touches is main-namespace structured data: entity labels, `P31`,
`P577`, `P57`, `P136`, `P2047`, `P495`, and `wikibase:sitelinks`.

## The one inference, disclosed

No Wikimedia page says in those words that a SPARQL query result export is CC0. What is stated is
that all the main-namespace structured data is CC0, and that the Query Service is one of the
documented ways to reach it. The step from the first statement to the second is a short inference,
and this paragraph is where it is recorded as an inference rather than passed off as a quotation.

## The credit is a courtesy

The city credit in the README is an obligation: CC BY 4.0 demands credit, a source link, a license
link, and a record of modifications. The films credit is the opposite. CC0 requires nothing at all,
and the data access page asks for the mention rather than requiring it. The credit this project gives
is therefore a courtesy, and a later reader should not build anything around an obligation that does
not exist.

## Provenance

- Query text: `scripts/films.rq`, run verbatim.
- Query date: 2026-09-04.
- Generator: `scripts/generate-films.mjs`, which reads a downloaded result file and imports no network
  client.
- Rows in the committed asset: 8,945.
- Emitted byte size: 1,243,148 bytes.

Modifications from the raw query result: unused bindings dropped, the three multi-valued properties
collapsed from pipe-joined literals to JSON arrays, and rows limited to films carrying at least 20
sitelinks.

Upstream values are emitted verbatim, including the one title carrying an em dash and the thirty
carrying en dashes. This project's rule against those characters governs prose it authors, not
third-party data, and rewriting a title would break reproducibility from the recorded query.

## Running the query

The user agent is not optional. The service blocks clients that ignore its user-agent policy, and the
URL is the contact channel, so a placeholder or a URL that does not resolve is worse than useless.
Send it verbatim:

```sh
curl -sS -G https://query.wikidata.org/sparql \
  --data-urlencode "query@scripts/films.rq" \
  -H "Accept: application/sparql-results+json" \
  -A "YART/0.1 (https://github.com/funkadelic/YART)" \
  -o scripts/films-result.json
```

Then run `npm run generate:films`. The result file is a scratch input and is gitignored; the
committed artifact is `src/data/films/films.json`.

## Service limits

These are operational terms, not license terms. They are recorded here because they are the whole
argument for a manual, human-run query rather than a fetch inside the generator, and the generator's
header points here for them.

| Limit               | Value                                                                             |
| ------------------- | --------------------------------------------------------------------------------- |
| Hard query deadline | 60 seconds. The recorded query runs in roughly 30                                 |
| Processing budget   | 60 seconds of processing time per client, meaning user agent plus IP, each minute |
| Throttling          | HTTP 429 with `Retry-After`; persistent violators can be temporarily banned       |
| User agent          | Clients that do not comply with the user-agent policy may be blocked completely   |

The consequence for this repository: never run the query from CI, and never run it twice back to back.
