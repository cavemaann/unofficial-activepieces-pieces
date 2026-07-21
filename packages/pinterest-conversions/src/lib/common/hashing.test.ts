import { createHash } from 'crypto';
import { describe, expect, it } from 'vitest';
import { identityHashing } from './hashing';

const sha256 = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

/**
 * The pre-hash heuristic is the only place this piece guesses at the *meaning*
 * of an input rather than its shape, and it guesses silently. Guessing wrong in
 * one direction double-hashes a digest (matches nobody); in the other it sends
 * a raw identifier to Pinterest unhashed. Neither surfaces an error, so the
 * boundary is pinned here rather than left to the field-level tests.
 */
describe('pre-hashed input detection', () => {
  const digest = sha256('person@example.com');

  it('passes a digest through instead of hashing it again', () => {
    expect(identityHashing.email(digest)).toBe(digest);
  });

  it('normalizes a digest to lowercase so it matches either casing', () => {
    expect(identityHashing.email(digest.toUpperCase())).toBe(digest);
  });

  it.each([
    ['63 hex chars', digest.slice(0, 63)],
    ['65 hex chars', digest + 'a'],
    ['64 chars with a non-hex character', digest.slice(0, 63) + 'z'],
  ])('hashes a value that is only nearly a digest (%s)', (_label, value) => {
    expect(identityHashing.email(value)).not.toBe(value.toLowerCase());
  });

  it('hashes an external ID that is 64 hex characters, as documented', () => {
    // The accepted tradeoff: a raw value in this shape is indistinguishable
    // from a digest, so it is treated as one. Asserted so the cost is visible
    // if anyone revisits the heuristic.
    const looksHashed = 'a'.repeat(64);
    expect(identityHashing.externalId(looksHashed)).toBe(looksHashed);
  });
});

describe('normalization before hashing', () => {
  it('lowercases an email', () => {
    expect(identityHashing.email('  Person@Example.COM  ')).toBe(
      sha256('person@example.com')
    );
  });

  it('strips symbols and spacing from a phone number', () => {
    expect(identityHashing.phone('+44 7700 900123')).toBe(
      sha256('447700900123')
    );
  });

  it('normalizes the three ways one number gets written onto one digest', () => {
    // The whole point of hashing: these have to collide or the same customer
    // reaches Pinterest as three different people.
    const e164 = sha256('447700900123');
    expect(identityHashing.phone('+44 7700 900123')).toBe(e164);
    expect(identityHashing.phone('+44 (0)7700 900123')).toBe(e164);
    expect(identityHashing.phone('0044 7700 900123')).toBe(e164);
  });

  // Two known gaps, asserted so the cost stays visible rather than living only
  // in a comment. Both produce a digest that matches nobody, silently. Neither
  // is fixable without a country prefix table — see the note in hashing.ts.
  it('does NOT match E.164 when the area code carries the trunk digit', () => {
    // '+44 (020) 7946 0958' is the same number as '+44 20 7946 0958', but the
    // zero survives. Stripping it is only correct per country: Italy keeps its
    // leading zero, so a blanket rule would break +39 06...
    expect(identityHashing.phone('+44 (020) 7946 0958')).toBe(
      sha256('4402079460958')
    );
    expect(identityHashing.phone('+44 (020) 7946 0958')).not.toBe(
      sha256('442079460958')
    );
  });

  it('does NOT match E.164 for a national number with no country code', () => {
    expect(identityHashing.phone('07700 900123')).toBe(sha256('7700900123'));
    expect(identityHashing.phone('07700 900123')).not.toBe(
      sha256('447700900123')
    );
  });

  it('reduces a city to letters and digits', () => {
    expect(identityHashing.city("  Stoke-on-Trent  ")).toBe(
      sha256('stokeontrent')
    );
  });

  it('keeps only the digits of a ZIP code', () => {
    expect(identityHashing.zip('SW1A 1AA')).toBe(sha256('11'));
  });

  it('keeps only the digits of a date of birth', () => {
    expect(identityHashing.dateOfBirth('1990-12-25')).toBe(sha256('19901225'));
  });

  it('preserves the case of a MAID', () => {
    // An IDFA is uppercase and a GAID is lowercase; both arrive canonical.
    const idfa = 'AEBE52E7-03EE-455A-B3C4-E57283966239';
    expect(identityHashing.maid(idfa)).toBe(sha256(idfa));
  });
});

describe('empty and missing values', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['an empty string', ''],
    ['whitespace only', '   '],
  ])('yields no value for %s rather than hashing it', (_label, value) => {
    // Hashing "" produces a perfectly valid digest that matches nobody, so an
    // absent identifier has to stay absent.
    expect(identityHashing.email(value)).toBeUndefined();
  });
});
