import { createHash } from 'crypto';

const SHA256_HEX = /^[a-f0-9]{64}$/i;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function hashWith(normalize: (raw: string) => string) {
  return (raw: string | undefined | null): string | undefined => {
    if (raw === undefined || raw === null) {
      return undefined;
    }
    const trimmed = String(raw).trim();
    if (trimmed.length === 0) {
      return undefined;
    }
    // Treat an input that already looks like a SHA-256 digest as pre-hashed and pass it
    // through, so callers who hash upstream aren't double-hashed. Tradeoff: a raw value that
    // happens to be exactly 64 hex chars is sent unhashed.
    if (SHA256_HEX.test(trimmed)) {
      return trimmed.toLowerCase();
    }
    return sha256(normalize(trimmed));
  };
}

const lower = (value: string): string => value.toLowerCase().trim();
const digitsOnly = (value: string): string => value.replace(/\D/g, '');
/**
 * Two notations are unwound before the digits are taken, both unambiguous:
 *
 * - A parenthesised `(0)` is the trunk prefix, written in brackets precisely to
 *   mean "drop this when dialling internationally". An area code in brackets is
 *   left alone, since `(020)` does not match the pattern.
 * - Leading zeros absorb the `00` international dialling prefix, so
 *   '0044 7700 900123' and '+44 7700 900123' reach the same digest.
 *
 * What is deliberately not handled is a bare national number with no country
 * code at all ('07700 900123'). Recovering that needs a default region, and a
 * wrong guess rewrites the number into a digest matching nobody —
 * indistinguishable from a user Pinterest has never seen. The field asks for a
 * country code; a caller who omits it gets no match rather than a wrong one.
 */
const phone = (value: string): string =>
  digitsOnly(value.replace(/\(0\)/g, '')).replace(/^0+/, '');
const stripSpacesAndPunctuation = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Pinterest accepts `f`, `m` or `n` here and receives it hashed, so a spelled
 * out value is a digest that matches nobody — and because it is a digest,
 * neither side can tell that apart from a user Pinterest has never seen.
 *
 * Only unambiguous spellings are mapped. Anything unrecognised is left alone
 * and sent as-is: it would not have matched either way, so there is nothing to
 * gain by second-guessing it.
 */
const GENDER_CODES: Record<string, string> = {
  female: 'f',
  male: 'm',
  nonbinary: 'n',
  'non-binary': 'n',
  non_binary: 'n',
};

const genderCode = (value: string): string => {
  const lowered = lower(value);
  return GENDER_CODES[lowered] ?? lowered;
};

export const identityHashing = {
  email: hashWith(lower),
  phone: hashWith(phone),
  firstName: hashWith(lower),
  lastName: hashWith(lower),
  city: hashWith(stripSpacesAndPunctuation),
  state: hashWith(lower),
  zip: hashWith(digitsOnly),
  country: hashWith(lower),
  gender: hashWith(genderCode),
  dateOfBirth: hashWith(digitsOnly),
  externalId: hashWith((value) => value.trim()),
  // Case is preserved, unlike the name and location fields. Pinterest specifies
  // "in lowercase" for em, fn, ln, ct, st, country and ge, and omits it for
  // external_id and hashed_maids — and the values arrive already canonical: a
  // GAID is lowercase, an IDFA is uppercase (AEBE52E7-03EE-...). Lowercasing
  // would change every IDFA digest, and a digest that matches nobody is
  // indistinguishable from a user Pinterest has never seen.
  maid: hashWith((value) => value.trim()),
};
