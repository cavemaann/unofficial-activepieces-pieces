import { z } from 'zod';

/**
 * Runtime validation for the Send Conversion Event action.
 *
 * This runs on the raw props, before normalization and hashing, so assertions
 * still see real emails and phone numbers rather than SHA-256 digests.
 *
 * It complements — rather than repeats — the framework's own validation.
 * `piecePropertiesUtils.buildSchema` checks presence and rough shape only:
 * `Number` props accept `string | number`, `StaticDropdown` props are
 * `unknown` with a non-null check, and `Array` props accept
 * `array | record | string`. Semantic validation is left to the piece.
 *
 * Fields are tightened one at a time. Entries marked PENDING are permissive
 * placeholders that accept exactly what the framework accepts, so they neither
 * reject nor alter input yet.
 */

/**
 * The 22 event names Pinterest documents. The API warns that an unlisted value
 * causes the event to be rejected or to report incorrectly, and the framework
 * does not enforce dropdown options at runtime, so this enum is closed.
 *
 * `custom` is a literal accepted value, not a mode selector — Pinterest has no
 * field for naming a custom event.
 */
export const PINTEREST_EVENT_NAMES = [
  'add_payment_info',
  'add_to_cart',
  'add_to_wishlist',
  'app_install',
  'app_open',
  'checkout',
  'contact',
  'customize_product',
  'find_location',
  'initiate_checkout',
  'lead',
  'page_visit',
  'schedule',
  'search',
  'signup',
  'start_trial',
  'submit_application',
  'subscribe',
  'view_category',
  'view_content',
  'watch_video',
  // Listed last because it is the catch-all, not because Pinterest orders it so.
  'custom',
] as const;

export type PinterestEventName = (typeof PINTEREST_EVENT_NAMES)[number];

/**
 * Labels for the action's dropdown. Typing this as a total record over
 * `PinterestEventName` makes the compiler reject a missing or unknown key, so
 * the dropdown cannot drift from the enum.
 */
const EVENT_LABELS: Record<PinterestEventName, string> = {
  add_payment_info: 'Add Payment Info',
  add_to_cart: 'Add to Cart',
  add_to_wishlist: 'Add to Wishlist',
  app_install: 'App Install',
  app_open: 'App Open',
  checkout: 'Checkout',
  contact: 'Contact',
  customize_product: 'Customize Product',
  find_location: 'Find Location',
  initiate_checkout: 'Initiate Checkout',
  lead: 'Lead',
  page_visit: 'Page Visit',
  schedule: 'Schedule',
  search: 'Search',
  signup: 'Sign Up',
  start_trial: 'Start Trial',
  submit_application: 'Submit Application',
  subscribe: 'Subscribe',
  view_category: 'View Category',
  view_content: 'View Content',
  watch_video: 'Watch Video',
  custom: 'Custom',
};

/** The single source for the action's Event Name dropdown. */
export const PINTEREST_EVENT_OPTIONS = PINTEREST_EVENT_NAMES.map((value) => ({
  label: EVENT_LABELS[value],
  value,
}));

/**
 * Where the conversion happened. Ordered as the dropdown presents them.
 */
export const PINTEREST_ACTION_SOURCES = [
  'web',
  'offline',
  'app_android',
  'app_ios',
] as const;

export type PinterestActionSource = (typeof PINTEREST_ACTION_SOURCES)[number];

/** Total record, so the dropdown cannot drift from the enum. */
const ACTION_SOURCE_LABELS: Record<PinterestActionSource, string> = {
  web: 'Web',
  offline: 'Offline',
  app_android: 'Android App',
  app_ios: 'iOS App',
};

/** The single source for the action's Action Source dropdown. */
export const PINTEREST_ACTION_SOURCE_OPTIONS = PINTEREST_ACTION_SOURCES.map(
  (value) => ({
    label: ACTION_SOURCE_LABELS[value],
    value,
  })
);

const dropNullish = <T>(value: T | null | undefined): T | undefined =>
  value ?? undefined;

/** PENDING: accepts what the framework accepts for a text prop. */
const pendingText = z.string().nullish().transform(dropNullish);

/** An already-hashed identifier, which must pass through untouched. */
const SHA256_HEX = /^[a-f0-9]{64}$/i;

/**
 * Deliberately minimal: one `@`, something on each side, no whitespace.
 *
 * Not a correctness check on the address. Judging exotic-but-valid addresses is
 * how email regexes go wrong, and a rejected real address costs a conversion.
 * This only catches the wrong column being mapped — a name, an order ID, "N/A".
 */
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+$/;

/**
 * Unlike every other field so far, a bad value here is undetectable by anyone.
 * Pinterest receives a SHA-256 digest, so `"N/A"` hashes to something perfectly
 * well-formed that simply never matches a user — no error, no warning, from us
 * or from them. There is no authority downstream to defer to, which is why this
 * is checked locally when `event_source_url` is not.
 *
 * A value that fails is treated as no email rather than failing the run. If it
 * was the only identifier, the existing cross-field rule already rejects the
 * event; if another identifier is present, the conversion is still attributable
 * and worth sending.
 */
function usableEmail(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const raw = value.trim();
  if (!raw) return undefined;
  // Pre-hashed input has no `@`, so it has to be recognised before the shape
  // check or callers who hash upstream would lose their identifier.
  if (SHA256_HEX.test(raw)) return raw;
  return LOOKS_LIKE_EMAIL.test(raw) ? raw : undefined;
}

const email = z
  .string()
  .nullish()
  .transform(usableEmail);

/**
 * Passed to Pinterest as given, minus surrounding whitespace.
 *
 * Deliberately unvalidated. Validating here would mean judging a URL by the
 * WHATWG parser's rules rather than Pinterest's, so anything they accept but
 * `new URL()` rejects would become attribution data silently discarded, with no
 * way for the caller to discover it.
 *
 * Letting it through is the recoverable direction: Pinterest either accepts it,
 * warns via `warning_message`, or rejects it with a reason that reaches the
 * caller through the existing `error_message` handling — their wording, not a
 * rule invented here.
 *
 * Trimming is safe in a way it is not for `event_id`: surrounding whitespace is
 * not part of any URL, so removing it cannot change which page this refers to.
 */
const eventSourceUrl = z
  .string()
  .nullish()
  .transform((value): string | undefined => value?.trim() || undefined);

/**
 * A `Number` prop arrives as `string | number` — typing 3 into the UI gives the
 * number, a bound expression usually gives `"3"`. Pinterest declares num_items
 * as `integer<int64>`, so the same flow would send two different JSON types
 * depending only on how the field was filled.
 *
 * A numeric string becomes a number. Anything else is forwarded unchanged
 * rather than coerced: `Number("abc")` is `NaN`, which `JSON.stringify` writes
 * as `null` — a silent wrong value where the original string produces a type
 * error from Pinterest that names the field. Fractions are forwarded too, for
 * the same reason; rounding 3.7 to 4 would invent a quantity nobody stated.
 */
const numericIfPossible = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((value): string | number | undefined => {
    if (value == null) return undefined;
    if (typeof value === 'number') return value;
    const trimmed = value.trim();
    if (trimmed === '') return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : trimmed;
  });

/**
 * A checkbox whose value is discarded when it cannot be read, rather than
 * failing the run.
 *
 * Only for flags where absence is neutral. `opt_out` and `test_mode` use the
 * strict `checkbox` because absence there is an affirmative "track this user"
 * and "record this for real" — see the note on field 6.
 */
const optionalFlag = z
  .union([z.boolean(), z.string()])
  .nullish()
  .transform((value): boolean | undefined => {
    if (typeof value === 'boolean') return value;
    const normalized = value?.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
    return undefined;
  });

/** PENDING: `Number` props reach the action as `string | number`. */
const pendingNumber = z
  .union([z.string(), z.number()])
  .nullish()
  .transform(dropNullish);

/**
 * `Checkbox` props reach the action as `boolean | string`, because a value can
 * be bound to an expression or supplied by an AI tool call rather than set with
 * the UI toggle.
 *
 * The string "false" is truthy, so reading one directly inverts the field.
 * `z.coerce.boolean()` has exactly this bug and must not be used here. Only
 * values whose intent is unambiguous are accepted; anything else fails loudly
 * rather than being guessed in either direction.
 */
const checkbox = z
  .union([z.boolean(), z.string()])
  .nullish()
  .transform((value, ctx): boolean | undefined => {
    if (value === null || value === undefined) {
      return undefined;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === '') {
      return undefined;
    }
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
    ctx.addIssue({
      code: 'custom',
      message: `must be true or false (received "${value}")`,
    });
    return z.NEVER;
  });

/**
 * Matches a value against a closed list, normalizing surrounding whitespace and
 * case first, so "Checkout" and " WEB " are accepted as `checkout` and `web`.
 *
 * Pinterest's accepted values are all lowercase, so a differently-cased value is
 * unambiguous in intent rather than a distinct value being asked for. These
 * often arrive from an upstream system, a spreadsheet, or a CSV export where the
 * human-readable capitalization is the natural one.
 */
function normalizedEnum<const T extends readonly [string, ...string[]]>(
  values: T,
  error: string
) {
  // The message is applied to both stages: without it, a missing or non-string
  // value fails the string check first and reports "expected string, received
  // undefined" instead of listing what is accepted.
  return z
    .string({ error })
    .transform((value) => value.trim().toLowerCase())
    .pipe(z.enum(values, { error }));
}

/**
 * Bounds for a sane conversion event. These are ours, not Pinterest's — they
 * exist to catch a value that is not really Unix seconds, rather than to enforce
 * any documented window.
 */
const EARLIEST_PLAUSIBLE = 946_684_800; // 2000-01-01T00:00:00Z
const LATEST_PLAUSIBLE = 4_102_444_800; // 2100-01-01T00:00:00Z

/**
 * ISO 8601 with a mandatory timezone offset, allowing a space separator instead
 * of `T` because that is what SQL databases emit.
 *
 * An offset is required because without one the value does not identify an
 * instant: "2026-07-20T10:00:00" is a different moment in every zone, and
 * "2026-07-20" is midnight in an unstated one. Guessing costs up to 14 hours.
 *
 * Slash-separated and month-name dates are deliberately unmatched. `07/08/2026`
 * is August 7th in the US and July 8th almost everywhere else, and `Date.parse`
 * silently picks the US reading — a flow would record every event a month off
 * with nothing to indicate it.
 */
const ISO_DATE_TIME =
  /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?)(Z|[+-]\d{2}:?\d{2})$/i;

type TimeResult = { seconds: number } | { error: string };

/**
 * Named only to make an error message useful. The value is never converted on
 * this basis — a large number is out of range, not silently rescaled.
 */
function likelyUnit(value: number): string | undefined {
  const abs = Math.abs(value);
  if (abs >= 1e17) return 'nanoseconds';
  if (abs >= 1e14) return 'microseconds';
  if (abs >= 1e11) return 'milliseconds';
  return undefined;
}

function secondsFromNumber(value: number): TimeResult {
  if (!Number.isFinite(value)) {
    return { error: 'must be a Unix timestamp in seconds' };
  }
  const seconds = Math.floor(value);
  if (seconds < EARLIEST_PLAUSIBLE || seconds > LATEST_PLAUSIBLE) {
    const unit = likelyUnit(seconds);
    const hint = unit
      ? ` — this looks like ${unit}, so divide it down to seconds first`
      : '';
    return {
      error: `must be a Unix timestamp in seconds, but ${seconds} is outside the supported range${hint}`,
    };
  }
  return { seconds };
}

function secondsFromString(raw: string): TimeResult {
  const value = raw.trim();

  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return secondsFromNumber(Number(value));
  }

  const match = ISO_DATE_TIME.exec(value);
  if (!match) {
    return {
      error: `must be a Unix timestamp in seconds or an ISO 8601 date with a timezone, such as "2026-07-20T10:00:00Z" (received "${raw}")`,
    };
  }

  const [, date, time, offset] = match;
  const parsed = Date.parse(`${date}T${time}${offset}`);
  if (Number.isNaN(parsed)) {
    return { error: `is not a real date (received "${raw}")` };
  }
  return secondsFromNumber(Math.floor(parsed / 1000));
}

/**
 * Required: an event with no time is not defaulted to now, because a conversion
 * that happened earlier would be recorded at the wrong moment with nothing to
 * indicate it.
 */
const eventTime = z
  .union([z.string(), z.number()], {
    error: 'is required — provide when the conversion happened',
  })
  .transform((value, ctx): number => {
    const result =
      typeof value === 'number'
        ? secondsFromNumber(value)
        : secondsFromString(value);
    if ('error' in result) {
      ctx.addIssue({ code: 'custom', message: result.error });
      return z.NEVER;
    }
    return result.seconds;
  });

/** Display-only props carry no value. */
const markdown = z.unknown().optional();

const baseSchema = z.object({
  // --- Field 1: reviewed ---------------------------------------------------
  event_name: normalizedEnum(
    PINTEREST_EVENT_NAMES,
    `must be one of Pinterest's supported events (${PINTEREST_EVENT_NAMES.join(', ')})`
  ),

  // --- Field 2: reviewed ---------------------------------------------------
  // `event_source_url` is left optional for `web`: Pinterest recommends it
  // rather than requiring it, so demanding it here would block valid flows.
  action_source: normalizedEnum(
    PINTEREST_ACTION_SOURCES,
    `must be one of ${PINTEREST_ACTION_SOURCES.join(', ')}`
  ),

  // --- Field 3: reviewed ---------------------------------------------------
  event_time: eventTime,

  // --- Field 4: reviewed ---------------------------------------------------
  // Pinterest requires a non-empty string, but the prop stays optional: the
  // action substitutes a UUID when this is blank, so the requirement is met
  // without forcing a value on flows that are not deduplicating against the
  // Pinterest tag. Nothing further to assert here — any string is a legal ID.
  event_id: pendingText,

  // --- Field 5: reviewed ---------------------------------------------------
  // Optional even for `web` (see field 2), and unvalidated: Pinterest is the
  // authority on what it accepts here.
  event_source_url: eventSourceUrl,

  // --- Field 6: reviewed ---------------------------------------------------
  // Pinterest documents neither a requirement nor a default for this, so an
  // absent value stays absent rather than becoming `false`. Under every reading
  // that is the safe direction: if their default is false, omitting and sending
  // false are the same request, and if absent means "not stated", sending false
  // would assert a consent claim the caller never made. The action omits the
  // key entirely when this is undefined.
  //
  // Malformed values still fail the run rather than being dropped — see the
  // note on `checkbox`.
  opt_out: checkbox,

  // --- opt_out_type: reviewed ----------------------------------------------
  // Sent in `custom_data`, though it sits beside `opt_out` in the form because
  // that is where someone looking for privacy controls will expect it.
  //
  // A comma-separated flag list, forwarded untouched. Pinterest documents the
  // accepted values in a Help Center article rather than in the API schema, so
  // there is no list here to enforce against — and they see this unhashed, so
  // an unrecognised flag is theirs to reject.
  opt_out_type: pendingText,

  customer_info: markdown,

  // --- Field 7: reviewed ---------------------------------------------------
  // Sent as `em`: an array of SHA-256 hashes of the lowercased address.
  // Pinterest specifies lowercasing only; the trim is ours, and is safe because
  // whitespace is not part of any address, so removing it can only make a match
  // more likely.
  email: email,

  // --- Fields 8-11: reviewed -----------------------------------------------
  // Normalization for all four is in `hashing.ts` and matches the spec exactly:
  // phone keeps digits only and strips symbols, letters, spaces and leading
  // zeros; names lowercase; city lowercases and drops spaces and punctuation.
  // Nothing is validated — each is hashed, so a wrong value is a digest that
  // matches nobody, which a check could detect but not improve on.
  phone: pendingText,
  first_name: pendingText,
  last_name: pendingText,
  city: pendingText,

  // --- Field 12 (state): reviewed ------------------------------------------
  // Lowercased on the way to the hash, which is all Pinterest specifies. No
  // check and no aliasing: "two-letter code" is the whole of the spec, with no
  // country context, so "ca" cannot be resolved to a scheme and "California"
  // cannot be mapped to anything. A check that could only reject would not help
  // either — an unmatchable hash and an absent field match equally well.
  state: pendingText,

  // --- Field 13 (zip): reviewed --------------------------------------------
  // Digits only, as specified. Non-numeric postcodes (UK, Canada, NL) lose
  // their letters and will not match, but that is Pinterest's stated format
  // rather than something to work around here.
  zip: pendingText,

  // --- Field 14 (country): reviewed ----------------------------------------
  // Lowercased only, like `state`. Aliasing is possible here since ISO-3166
  // alpha-2 is globally defined, but it is not obviously safe: a wrong country
  // is a plausible value rather than a miss, so it attributes the user to the
  // wrong cohort instead of none. "Georgia" is a country and a US state, and
  // IE/IRL and AT/AU are routinely confused upstream. Alpha-3 to alpha-2 is the
  // one unambiguous mapping available if it turns out to be needed.
  country: pendingText,
  // --- Field 15 (gender): reviewed -----------------------------------------
  // `hashing.ts` maps the spelled-out spellings onto the f/m/n codes Pinterest
  // matches. Unrecognised values pass through lowercased rather than being
  // dropped: they would not match either way, so rejecting them gains nothing.
  gender: pendingText,

  // --- Field 16 (date_of_birth): reviewed ----------------------------------
  // Digits only, which turns any separator style into YYYYMMDD — the order the
  // spec gives ("year, month, and day"). The order is the part that matters and
  // the part we cannot verify per-value: a DD/MM/YYYY source hashes to a
  // well-formed digest that matches nobody, which is why the prop description
  // states the expected order rather than leaving it to be inferred.
  date_of_birth: pendingText,

  // --- Field 17 (external_id): reviewed ------------------------------------
  // Trimmed but not lowercased, matching the spec's omission of a case rule
  // here (contrast em/fn/ln/ct/st/country/ge, which all say "in lowercase").
  //
  // Known limitation: `hashing.ts` treats any 64-character hex value as
  // already hashed and forwards it unhashed, so an external ID that happens to
  // be a 64-char hex token is sent raw and never matches. Left as-is because
  // the alternative fails just as silently in the other direction — a
  // pre-hashed ID would be hashed twice — and there is no evidence which case
  // is more common.
  external_id: pendingText,

  // --- Field 18 (maid): reviewed -------------------------------------------
  // Case preserved; see the note in `hashing.ts`.
  maid: pendingText,

  // --- Fields 19-22: reviewed ----------------------------------------------
  // Sent unhashed, so Pinterest can see these and reject or warn on them. That
  // makes them the one part of `user_data` where a local check would duplicate
  // an authority that already exists — the same call as `event_source_url`.
  // Trimmed only, which is safe for an IP and a user agent, and near enough for
  // click_id and partner_id: both are opaque third-party tokens where padding
  // is an artefact of templating rather than part of the value.
  client_ip_address: pendingText,
  client_user_agent: pendingText,
  click_id: pendingText,
  partner_id: pendingText,

  event_details: markdown,

  // --- Field 26 (currency): reviewed ---------------------------------------
  // Sent unhashed and untouched. Pinterest sees this one, so it can reject an
  // unknown code with a better message than a local ISO-4217 table would give,
  // and such a table is exactly the kind that drifts. Case is left alone for
  // the same reason: if lowercase is a problem, they can say so.
  currency: pendingText,

  // --- Field 27 (value): reviewed ------------------------------------------
  // Declared `string`, parsed into a double on Pinterest's side, so
  // `buildCustomData` stringifies it. That looks inconsistent beside
  // `num_items`, which is sent as a number — but the two really are declared
  // differently, so the shapes are right.
  value: pendingNumber,
  // --- Field 28 (content_ids): reviewed ------------------------------------
  // An Array prop can arrive as an array, a string, or a record. The action
  // maps over this, so the shape has to be settled here or a bound string
  // becomes an opaque `.map is not a function`.
  //
  // A lone string is wrapped rather than rejected: one product ID is a
  // perfectly ordinary thing to send, and it is what a single-value expression
  // produces. The contents are not inspected — Pinterest receives these
  // unhashed and is the authority on what a valid product ID looks like.
  content_ids: z
    .union([z.array(z.unknown()), z.string()], {
      error: 'must be a product ID or a list of them',
    })
    .nullish()
    .transform((value) =>
      value == null ? undefined : Array.isArray(value) ? value : [value]
    ),
  // --- Fields 29-31: reviewed ----------------------------------------------
  // Free text, sent unhashed and trimmed only. There is nothing to normalize
  // against and nothing Pinterest cannot see for itself.
  content_name: pendingText,
  content_category: pendingText,
  content_brand: pendingText,
  // --- Field 32 (num_items): reviewed --------------------------------------
  // Declared `integer<int64>`, so a numeric string is converted to a number.
  // Not rounded and not range-checked: Pinterest sees this unhashed and will
  // reject a fraction or an overflow with a message naming the field.
  num_items: numericIfPossible,
  // --- order_id: reviewed --------------------------------------------------
  // Sent verbatim, not trimmed. Pinterest uses this to deduplicate events, so
  // it is matched against an order ID sent from somewhere else — and trimming
  // only our side of that pair is what turns a working match into a duplicate
  // conversion. Same reasoning as `event_id`.
  //
  // This is the one place the argument applies: click_id and partner_id are
  // opaque third-party tokens nobody authors by hand, so padding there is a
  // templating artefact rather than part of the value.
  order_id: pendingText,

  // --- search_string: reviewed ---------------------------------------------
  // Free text, trimmed. Not a matching key — it is the query the user typed,
  // so surrounding whitespace is noise rather than meaning.
  search_string: pendingText,

  // Flat app and device fields, sent at the top level of the event. Pinterest
  // documents no length limits or allowed values for these, so there is nothing
  // to constrain beyond dropping blanks.
  app_device: markdown,
  app_id: pendingText,
  app_name: pendingText,
  app_version: pendingText,
  device_brand: pendingText,
  device_carrier: pendingText,
  device_model: pendingText,
  device_type: pendingText,

  // --- language / os_version / wifi: reviewed ------------------------------
  // Flat fields on the event, like the rest of this group, and sent unhashed —
  // so `language` gets no ISO-639-1 check for the same reason `currency` gets
  // no ISO-4217 one: Pinterest can see the value and say so itself.
  //
  // `wifi` is a three-state dropdown, not a checkbox, and `optionalFlag` reads
  // its 'true'/'false' option values as well as a raw boolean. Unknown is the
  // ordinary case for a connection type, and a checkbox cannot say it: an
  // untouched box would assert "not on wifi" for every event. A value that
  // cannot be read is likewise dropped rather than costing the conversion.
  //
  // `opt_out` stays a checkbox because absent and false mean the same thing
  // there — neither claims the user opted out.
  language: pendingText,
  os_version: pendingText,
  wifi: optionalFlag,

  advanced: markdown,
  // --- partner_name: reviewed ----------------------------------------------
  // Trimmed, otherwise untouched and sent unhashed, so Pinterest can reject a
  // badly formed value itself.
  //
  // The lowercase "ss-partnername" convention in the prop description is
  // Pinterest's own wording ("The naming convention is 'ss-partnername'
  // lowercase. E.g 'ss-shopify'"). It is a convention rather than a validated
  // format, and only third-party senders set it, so it is not lowercased here.
  partner_name: pendingText,
  test_mode: checkbox,
});

/** Exported for the coverage test that keeps this schema in step with the action's props. */
export const conversionEventPropsShape = baseSchema.shape;

export const conversionEventPropsSchema = baseSchema;

export type ConversionEventProps = z.infer<typeof baseSchema>;

/**
 * Cross-field rules, kept separate from the object schema on purpose.
 *
 * Zod runs `.superRefine()` only when the base schema parses cleanly, so
 * expressing these as refinements would hide them behind any single field
 * error — a user with a bad Event Name and no customer identifier would be told
 * about the first, fix it, run again, then be told about the second. These read
 * the raw input defensively so they report alongside field errors rather than
 * after them.
 */
function collectCrossFieldIssues(props: unknown): string[] {
  const raw = (props ?? {}) as Record<string, unknown>;
  const issues: string[] = [];

  // Must agree with the `email` parser: a value it discards is not an
  // identifier, and counting it here would send an event with none at all.
  const hasEmail = usableEmail(raw['email']) !== undefined;
  const hasMaid = notBlank(raw['maid']);
  const hasIpAndUserAgent =
    notBlank(raw['client_ip_address']) && notBlank(raw['client_user_agent']);

  if (!hasEmail && !hasMaid && !hasIpAndUserAgent) {
    // Naming the rejected value matters here: without it the error reads as
    // "you gave no email" to someone who is looking straight at one.
    issues.push(
      notBlank(raw['email'])
        ? `Email — "${String(raw['email']).trim()}" is not an email address, and no other customer identifier was provided. Supply a valid Email, a Mobile Advertising ID, or both Client IP Address and Client User Agent.`
        : 'At least one customer identifier is required: provide Email, a Mobile Advertising ID, or both Client IP Address and Client User Agent.'
    );
  }

  return issues;
}

/**
 * Parses the action's props, throwing a single error that lists every problem
 * at once so a user fixes all of them in one edit rather than one per run.
 */
export function parseConversionEventProps(props: unknown): ConversionEventProps {
  const result = baseSchema.safeParse(props);

  const lines = [
    ...(result.success ? [] : formatIssueLines(result.error)),
    ...collectCrossFieldIssues(props).map((message) => `  • ${message}`),
  ];

  if (lines.length > 0) {
    const unique = [...new Set(lines)];
    throw new Error(
      `Invalid input for Send Conversion Event:\n${unique.join('\n')}`
    );
  }

  // Unreachable unless the parse succeeded: any failure produced a line above.
  return (result as { data: ConversionEventProps }).data;
}

function formatIssueLines(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const key = issue.path[0];
    if (typeof key !== 'string') {
      return `  • ${issue.message}`;
    }
    return `  • ${DISPLAY_NAMES[key] ?? key} — ${issue.message}`;
  });
}

function notBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

const DISPLAY_NAMES: Record<string, string> = {
  event_name: 'Event Name',
  action_source: 'Action Source',
  event_time: 'Event Time',
  event_id: 'Event ID',
  event_source_url: 'Event Source URL',
  opt_out: 'Opt Out',
  opt_out_type: 'Opt Out Type',
  email: 'Email',
  phone: 'Phone Number',
  first_name: 'First Name',
  last_name: 'Last Name',
  city: 'City',
  state: 'State',
  zip: 'ZIP Code',
  country: 'Country',
  gender: 'Gender',
  date_of_birth: 'Date of Birth',
  external_id: 'External ID',
  maid: 'Mobile Advertising ID (MAID)',
  client_ip_address: 'Client IP Address',
  client_user_agent: 'Client User Agent',
  click_id: 'Click ID',
  partner_id: 'Partner ID',
  currency: 'Currency',
  value: 'Value',
  content_ids: 'Content IDs',
  content_name: 'Content Name',
  content_category: 'Content Category',
  content_brand: 'Content Brand',
  num_items: 'Number of Items',
  order_id: 'Order ID',
  search_string: 'Search String',
  app_id: 'App ID',
  app_name: 'App Name',
  app_version: 'App Version',
  device_brand: 'Device Brand',
  device_carrier: 'Device Carrier',
  device_model: 'Device Model',
  device_type: 'Device Type',
  language: 'Language',
  os_version: 'OS Version',
  wifi: 'Wi-Fi',
  partner_name: 'Partner Name',
  test_mode: 'Test Mode',
};
