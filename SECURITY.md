# Security policy

## Scope

YART is a client-only static bundle. It has no server, no database, no authentication, no cookies, and no runtime configuration. The only request it makes is for its own dataset asset, served from the same origin as the page. There is no user data to expose and nothing to log into.

That leaves a small surface, and reports about it are still welcome:

- the published site at https://funkadelic.github.io/YART/
- the source in this repository, including the build and release pipeline
- the committed dependency set

Out of scope: findings that need a compromised host, a modified browser, or a browser extension, since a policy this project can set does not constrain any of them.

## Reporting

Report privately through GitHub, at https://github.com/funkadelic/YART/security/advisories/new. Please do not open a public issue for a suspected vulnerability.

Include what you did, what happened, and what you expected. A link to the running site with the address bar contents, or a failing test, is worth more than a description of either.

You should get an acknowledgement within a week. This is a portfolio project maintained in spare time, so there is no paid bounty and no guaranteed fix window.

## Supported versions

The published site is built from `main`, and `main` is the only supported version. There are no releases and no backports.
