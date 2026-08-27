/**
 * A value the caller has already established is present, narrowed from the
 * optional type an index access or a capture group carries.
 *
 * `noUncheckedIndexedAccess` types every index access as possibly absent, which
 * is correct at the type level and repetitive at a use site whose invariant is
 * asserted somewhere else: a fixture case that counts the rows it needs, or a
 * regular expression whose group cannot be absent once the match itself is.
 * The alternative at each of those sites is a non-null assertion, which turns a
 * fixture that stopped carrying a row into a property read on undefined several
 * frames away from the cause. This reports the cause instead.
 */
export function required<T>(value: T | undefined, what: string): T {
  if (value === undefined) {
    throw new Error(`${what} is absent`);
  }

  return value;
}
