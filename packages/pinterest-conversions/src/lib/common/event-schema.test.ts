import { describe, expect, it } from 'vitest';
import {
  buildAppDeviceData,
  buildAppInfo,
  buildCustomData,
  buildUserData,
  resolveEventId,
  sendConversionEvent,
} from '../actions/send-conversion-event';
import translation from '../../i18n/translation.json';
import {
  PINTEREST_ACTION_SOURCES,
  PINTEREST_ACTION_SOURCE_OPTIONS,
  PINTEREST_EVENT_NAMES,
  PINTEREST_EVENT_OPTIONS,
  conversionEventPropsShape,
  parseConversionEventProps,
} from './event-schema';

const parseProps = parseConversionEventProps;

/** Minimal props that satisfy every rule, so each test varies one thing. */
function validProps(overrides: Record<string, unknown> = {}) {
  return {
    event_name: 'checkout',
    action_source: 'web',
    event_time: 1737331200,
    email: 'Person@Example.com',
    ...overrides,
  };
}

describe('schema coverage', () => {
  it('validates every prop the action declares', () => {
    // The schema strips keys it does not declare, so a prop added to the action
    // without a matching entry here would silently vanish before it is sent.
    const actionProps = Object.keys(sendConversionEvent.props);
    const schemaProps = Object.keys(conversionEventPropsShape);
    expect(schemaProps.sort()).toEqual(actionProps.sort());
  });
});

describe('translations', () => {
  it('has an entry for every dropdown label', () => {
    const keys = Object.keys(translation);
    for (const option of [
      ...PINTEREST_EVENT_OPTIONS,
      ...PINTEREST_ACTION_SOURCE_OPTIONS,
    ]) {
      expect(keys).toContain(option.label);
    }
  });
});

describe('event_name', () => {
  it('accepts every documented Pinterest event', () => {
    for (const eventName of PINTEREST_EVENT_NAMES) {
      const parsed = parseProps(validProps({ event_name: eventName }));
      expect(parsed.event_name).toBe(eventName);
    }
  });

  it('covers all 22 documented events', () => {
    expect(PINTEREST_EVENT_NAMES).toHaveLength(22);
  });

  it.each([
    ['Checkout', 'checkout'],
    ['CHECKOUT', 'checkout'],
    ['  page_visit  ', 'page_visit'],
    ['Add_To_Cart', 'add_to_cart'],
  ])('normalizes %j to %j', (input, expected) => {
    const parsed = parseProps(validProps({ event_name: input }));
    expect(parsed.event_name).toBe(expected);
  });

  it('passes "custom" through as a literal event name', () => {
    // Pinterest documents `custom` as an accepted value, not a mode selector —
    // there is no field for naming a custom event.
    const parsed = parseProps(validProps({ event_name: 'custom' }));
    expect(parsed.event_name).toBe('custom');
  });

  it('rejects an event name that is not on the documented list', () => {
    // The framework does not enforce dropdown options at runtime, so an
    // off-list value can reach the action via a connected or dynamic value.
    expect(() =>
      parseProps(validProps({ event_name: 'my_custom_thing' }))
    ).toThrow(/Event Name/);
  });

  it('rejects a missing event name, listing what is accepted', () => {
    // A missing value fails the string check before reaching the enum, so
    // without a shared message it would report a bare type error instead.
    const props = validProps();
    delete (props as Record<string, unknown>)['event_name'];
    expect(() => parseProps(props)).toThrow(
      /Event Name — must be one of/
    );
  });
});

describe('action_source', () => {
  it('accepts every documented source', () => {
    for (const source of PINTEREST_ACTION_SOURCES) {
      const parsed = parseProps(validProps({ action_source: source }));
      expect(parsed.action_source).toBe(source);
    }
  });

  it.each([
    ['Web', 'web'],
    ['WEB', 'web'],
    ['  web  ', 'web'],
    ['App_iOS', 'app_ios'],
  ])('normalizes %j to %j', (input, expected) => {
    const parsed = parseProps(validProps({ action_source: input }));
    expect(parsed.action_source).toBe(expected);
  });

  it('rejects a source that is not on the documented list', () => {
    // The framework does not enforce dropdown options at runtime, so an
    // off-list value can reach the action via a connected or dynamic value.
    expect(() =>
      parseProps(validProps({ action_source: 'website' }))
    ).toThrow(/Action Source/);
  });

  it('rejects a missing source, listing what is accepted', () => {
    const props = validProps();
    delete (props as Record<string, unknown>)['action_source'];
    expect(() => parseProps(props)).toThrow(
      /Action Source — must be one of/
    );
  });

  it('does not require an event source URL for web events', () => {
    // Pinterest recommends event_source_url rather than requiring it.
    expect(() =>
      parseProps(validProps({ action_source: 'web' }))
    ).not.toThrow();
  });
});

describe('event_time', () => {
  it.each([
    [1737331200, 1737331200],
    ['1737331200', 1737331200],
    ['  1737331200  ', 1737331200],
    [1737331200.9, 1737331200],
    ['2025-01-20T00:00:00Z', 1737331200],
    ['2025-01-20T00:00:00.500Z', 1737331200],
    ['2025-01-20 00:00:00Z', 1737331200],
    ['2025-01-20T01:00:00+01:00', 1737331200],
    ['2025-01-20T00:00:00+00:00', 1737331200],
  ])('reads %j as %i', (input, expected) => {
    const parsed = parseProps(validProps({ event_time: input }));
    expect(parsed.event_time).toBe(expected);
  });

  it.each([
    // A wrong unit is reported, never rescaled — the value could be a genuine
    // out-of-range seconds value, and guessing would silently move the event.
    [1737331200000, /looks like milliseconds/],
    [1737331200000000, /looks like microseconds/],
    [1737331200000000000, /looks like nanoseconds/],
  ])('rejects %i rather than rescaling it', (input, expected) => {
    expect(() =>
      parseProps(validProps({ event_time: input }))
    ).toThrow(expected);
  });

  it.each([
    // Without an offset these do not identify an instant.
    '2025-01-20T00:00:00',
    '2025-01-20',
    // Locale-ambiguous: Date.parse would silently pick the US reading.
    '07/08/2026',
    'Jul 8, 2026',
    'yesterday',
  ])('rejects %j as not resolvable to an instant', (input) => {
    expect(() =>
      parseProps(validProps({ event_time: input }))
    ).toThrow(/Event Time/);
  });

  it('rejects a missing event time rather than defaulting to now', () => {
    // Defaulting would record a conversion that happened earlier at the wrong
    // moment, with nothing in the response to indicate it.
    const props = validProps();
    delete (props as Record<string, unknown>)['event_time'];
    expect(() => parseProps(props)).toThrow(/Event Time — is required/);
  });

  it('rejects a date outside the plausible range', () => {
    expect(() =>
      parseProps(validProps({ event_time: '1969-07-20T20:17:00Z' }))
    ).toThrow(/Event Time/);
  });
});

describe('email', () => {
  it('rejects the event when the only identifier is not an email', () => {
    // The parser discards "N/A", so counting it as an identifier would send an
    // event with none at all — a hash of "N/A" is well-formed and matches
    // nobody, so neither we nor Pinterest would ever report the loss.
    expect(() => parseProps(validProps({ email: 'N/A' }))).toThrow(
      /"N\/A" is not an email address/
    );
  });

  it('keeps the event when another identifier survives', () => {
    const props = parseProps(validProps({ email: 'N/A', maid: 'abc-123' }));
    expect(props.email).toBeUndefined();
    expect(props.maid).toBe('abc-123');
  });

  it('passes a pre-hashed address through', () => {
    // Has no "@", so the digest check has to run before the shape check or
    // callers who hash upstream lose their identifier.
    const digest = 'a'.repeat(64);
    expect(parseProps(validProps({ email: digest })).email).toBe(digest);
  });
});

describe('customer identifier requirement', () => {
  it('accepts an email alone', () => {
    expect(() => parseProps(validProps())).not.toThrow();
  });

  it('accepts a MAID alone', () => {
    expect(() =>
      parseProps(validProps({ email: undefined, maid: 'abc-123' }))
    ).not.toThrow();
  });

  it('accepts IP and user agent together', () => {
    expect(() =>
      parseProps(
        validProps({
          email: undefined,
          client_ip_address: '203.0.113.1',
          client_user_agent: 'Mozilla/5.0',
        })
      )
    ).not.toThrow();
  });

  it('rejects an IP without a user agent', () => {
    expect(() =>
      parseProps(
        validProps({ email: undefined, client_ip_address: '203.0.113.1' })
      )
    ).toThrow(/At least one customer identifier/);
  });

  it('rejects when no identifier is supplied', () => {
    expect(() => parseProps(validProps({ email: undefined }))).toThrow(
      /At least one customer identifier/
    );
  });

  it('treats a whitespace-only identifier as missing', () => {
    expect(() => parseProps(validProps({ email: '   ' }))).toThrow(
      /At least one customer identifier/
    );
  });
});

describe('checkbox props', () => {
  // A Checkbox prop arrives as `boolean | string`. The string "false" is truthy,
  // so reading it directly inverts the field — for test_mode that means a live
  // conversion is validated but never recorded, and Pinterest still reports
  // success, so nothing surfaces the loss.
  it.each([
    ['false', false],
    ['FALSE', false],
    ['  false  ', false],
    ['true', true],
    ['TRUE', true],
  ])('reads the string %j as %s', (input, expected) => {
    const parsed = parseProps(validProps({ test_mode: input }));
    expect(parsed.test_mode).toBe(expected);
  });

  it.each([true, false])('passes the boolean %s through', (input) => {
    const parsed = parseProps(validProps({ test_mode: input }));
    expect(parsed.test_mode).toBe(input);
  });

  it.each([undefined, ''])('treats %j as unset', (input) => {
    const parsed = parseProps(validProps({ test_mode: input }));
    expect(parsed.test_mode).toBeUndefined();
  });

  it('rejects a value whose intent is ambiguous', () => {
    // Guessing here would silently pick a behaviour; failing is recoverable.
    expect(() =>
      parseProps(validProps({ test_mode: 'ture' }))
    ).toThrow(/Test Mode — must be true or false/);
  });

  it('applies the same rules to opt_out', () => {
    const parsed = parseProps(validProps({ opt_out: 'false' }));
    expect(parsed.opt_out).toBe(false);
    expect(() =>
      parseProps(validProps({ opt_out: 'nope' }))
    ).toThrow(/Opt Out — must be true or false/);
  });
});

describe('error aggregation', () => {
  it('reports every problem in a single error', () => {
    // One run of the flow should surface all fixes, not one per attempt.
    const error = captureError(() =>
      parseProps({ event_name: 'nope', action_source: 'web' })
    );
    expect(error).toMatch(/Event Name/);
    expect(error).toMatch(/At least one customer identifier/);
  });

  it('labels issues with the display name shown in the UI', () => {
    const error = captureError(() =>
      parseProps(validProps({ event_name: 'nope' }))
    );
    expect(error).toContain('Event Name');
    expect(error).not.toContain('event_name');
  });
});

describe('order_id', () => {
  it('is sent verbatim so it can match the value Pinterest deduplicates on', () => {
    // Trimming only our side of the pair breaks a match that would have
    // worked, and the result is a double-counted conversion. Contrast
    // search_string, which is trimmed because nothing matches against it.
    const customData = buildCustomData(
      parseProps(validProps({ order_id: '  1001  ', search_string: '  hat  ' }))
    );
    expect(customData['order_id']).toBe('  1001  ');
    expect(customData['search_string']).toBe('hat');
  });
});

describe('wifi', () => {
  it('drops a value it cannot read instead of failing the event', () => {
    // Contrast opt_out and test_mode, which throw on the same input. Not
    // knowing the connection is ordinary; it is not worth a conversion.
    expect(parseProps(validProps({ wifi: 'maybe' })).wifi).toBeUndefined();
    expect(() => parseProps(validProps({ opt_out: 'maybe' }))).toThrow();
  });

  it("reads the dropdown's string option values as booleans", () => {
    expect(parseProps(validProps({ wifi: 'true' })).wifi).toBe(true);
    expect(parseProps(validProps({ wifi: 'false' })).wifi).toBe(false);
  });

  it('says nothing at all when left empty', () => {
    // The payload-level half of this is in send-conversion-event.test.ts: wifi
    // is attached in run(), so asserting on a builder here would prove nothing.
    expect(parseProps(validProps({})).wifi).toBeUndefined();
  });

  it('still sends an explicit No', () => {
    // Distinct from empty: this one is a claim the user actually made.
    expect(parseProps(validProps({ wifi: false })).wifi).toBe(false);
  });

  it('reads 1 and 0 rather than dropping them', () => {
    // What a SQL bit column or a spreadsheet export produces.
    expect(parseProps(validProps({ wifi: 1 })).wifi).toBe(true);
    expect(parseProps(validProps({ wifi: 0 })).wifi).toBe(false);
  });

  it('drops an unreadable type instead of failing the run', () => {
    // The whole point of accepting unknown: a narrower union would throw here,
    // costing the conversion over a field nobody needs.
    expect(parseProps(validProps({ wifi: { on: true } })).wifi).toBeUndefined();
    expect(parseProps(validProps({ wifi: 7 })).wifi).toBeUndefined();
  });
});

describe('opt_out_type', () => {
  it('reaches custom_data', () => {
    // Declaring and validating a prop does not send it. Silently dropping this
    // one would leave a user believing they had expressed an LDP opt-out that
    // never left the flow.
    const customData = buildCustomData(
      parseProps(validProps({ opt_out_type: 'LDP' }))
    );
    expect(customData['opt_out_type']).toBe('LDP');
  });
});

describe('num_items', () => {
  it('converts a numeric string to a number', () => {
    // Pinterest declares integer<int64>. A bound expression yields "3", so
    // without this the JSON type depends on how the field was filled.
    expect(parseProps(validProps({ num_items: '3' })).num_items).toBe(3);
  });

  it('forwards an unparseable value unchanged', () => {
    // Number("abc") is NaN, which JSON.stringify writes as null — a silent
    // wrong value, where the string draws a type error naming the field.
    expect(parseProps(validProps({ num_items: 'abc' })).num_items).toBe('abc');
  });

  it('forwards an integer too large to represent, rather than rounding it', () => {
    // Number('99999999999999999999') is 1e20 — finite, so it passes the obvious
    // guard, but a different number than the one given. Converting would be the
    // same silent wrong value the NaN case above exists to avoid.
    const huge = '99999999999999999999';
    expect(parseProps(validProps({ num_items: huge })).num_items).toBe(huge);
  });

  it('still converts values that survive the round trip', () => {
    // The precision guard must not catch ordinary input.
    expect(parseProps(validProps({ num_items: '3.0' })).num_items).toBe(3);
    expect(parseProps(validProps({ num_items: '3.7' })).num_items).toBe(3.7);
    expect(
      parseProps(validProps({ num_items: '9007199254740991' })).num_items
    ).toBe(9_007_199_254_740_991);
  });
});

describe('content_ids', () => {
  it('wraps a lone product ID', () => {
    // An Array prop can arrive as a bare string, which the action would
    // otherwise hit with `.map is not a function`.
    expect(parseProps(validProps({ content_ids: 'SKU-1' })).content_ids).toEqual(
      ['SKU-1']
    );
  });
});

describe('hash normalization', () => {
  const hashOf = (overrides: Record<string, unknown>, key: string) =>
    (buildUserData(parseProps(validProps(overrides))) as
      Record<string, string[]>)[key][0];

  it('preserves MAID case', () => {
    // An IDFA is canonically uppercase and a GAID lowercase, so each arrives
    // already normalized. Lowercasing would change every IDFA digest into one
    // that matches nobody — indistinguishable from an unknown user.
    const idfa = 'AEBE52E7-03EE-455A-B3C4-E57283966239';
    expect(hashOf({ maid: idfa }, 'hashed_maids')).not.toBe(
      hashOf({ maid: idfa.toLowerCase() }, 'hashed_maids')
    );
  });

  it('maps a spelled-out gender onto the code Pinterest matches', () => {
    // Pinterest only matches f/m/n, and receives this hashed — so "Female"
    // would otherwise hash to a digest that silently matches no one.
    expect(hashOf({ gender: 'Female' }, 'ge')).toBe(
      hashOf({ gender: 'f' }, 'ge')
    );
  });

  it('leaves an unrecognised gender alone', () => {
    // It would not have matched either way, so there is nothing to gain by
    // guessing at it.
    expect(hashOf({ gender: 'xx' }, 'ge')).toBe(hashOf({ gender: 'XX' }, 'ge'));
  });
});

describe('buildUserData identifier mapping', () => {
  // Guards the invariant the old post-build hasRequiredMatchKey check enforced:
  // a supplied identifier must survive normalization and hashing into the payload.
  it('maps a non-blank email to a hashed em value', () => {
    const userData = buildUserData(parseProps(validProps()));
    expect(userData['em']).toEqual([expect.stringMatching(/^[a-f0-9]{64}$/)]);
  });

  it('maps a non-blank MAID to hashed_maids', () => {
    const userData = buildUserData(
      parseProps(validProps({ email: undefined, maid: 'abc-123' }))
    );
    expect(userData['hashed_maids']).toEqual([
      expect.stringMatching(/^[a-f0-9]{64}$/),
    ]);
  });

  it('passes IP and user agent through unhashed', () => {
    const userData = buildUserData(
      parseProps(
        validProps({
          email: undefined,
          client_ip_address: '203.0.113.1',
          client_user_agent: 'Mozilla/5.0',
        })
      )
    );
    expect(userData['client_ip_address']).toBe('203.0.113.1');
    expect(userData['client_user_agent']).toBe('Mozilla/5.0');
  });

  it('omits identifiers that were not supplied', () => {
    const userData = buildUserData(parseProps(validProps()));
    expect(userData).not.toHaveProperty('ph');
    expect(userData).not.toHaveProperty('hashed_maids');
  });
});

describe('buildAppDeviceData', () => {
  it('passes the flat app and device fields through, trimmed', () => {
    const data = buildAppDeviceData(
      parseProps(
        validProps({
          app_id: '  123456  ',
          app_name: 'Example',
          app_version: '2.1.0',
          device_brand: 'Apple',
          device_carrier: 'EE',
          device_model: 'iPhone 15',
          device_type: 'mobile',
        })
      )
    );
    expect(data).toEqual({
      app_id: '123456',
      app_name: 'Example',
      app_version: '2.1.0',
      device_brand: 'Apple',
      device_carrier: 'EE',
      device_model: 'iPhone 15',
      device_type: 'mobile',
    });
  });

  it('omits fields that were not supplied', () => {
    const data = buildAppDeviceData(
      parseProps(validProps({ app_id: '123', device_brand: '  ' }))
    );
    expect(data).toEqual({ app_id: '123' });
  });
});

describe('buildAppInfo', () => {
  it('duplicates the three app fields into the nested shape', () => {
    // Pinterest documents app_id, app_name and app_version both at the top
    // level and under `app_info`, using the same keys, without saying which one
    // is read. Both shapes carry the value rather than betting on one.
    const props = parseProps(
      validProps({
        app_id: '  123456  ',
        app_name: 'Example',
        app_version: '2.1.0',
      })
    );
    expect(buildAppInfo(props)).toEqual({
      app_info: { app_id: '123456', app_name: 'Example', app_version: '2.1.0' },
    });
    expect(buildAppDeviceData(props)).toMatchObject({
      app_id: '123456',
      app_name: 'Example',
      app_version: '2.1.0',
    });
  });

  it('omits app_info entirely when no app field was supplied', () => {
    // An empty object would otherwise be sent for every web conversion.
    expect(
      buildAppInfo(parseProps(validProps({ device_brand: 'Apple' })))
    ).toEqual({});
  });
});

describe('event_source_url', () => {
  it('trims but does not otherwise touch the value', () => {
    // Unvalidated on purpose: Pinterest decides what it accepts, so a bare path
    // is forwarded rather than judged by the WHATWG parser's rules.
    const props = parseProps(
      validProps({ event_source_url: '  /checkout/success  ' })
    );
    expect(props.event_source_url).toBe('/checkout/success');
  });

  it('omits a blank URL', () => {
    const props = parseProps(validProps({ event_source_url: '   ' }));
    expect(props.event_source_url).toBeUndefined();
  });
});

describe('event_id', () => {
  it('sends a supplied ID verbatim so it can match the Pinterest tag', () => {
    // Not trimmed: Pinterest matches this against the tag's value as an opaque
    // string, so altering it risks breaking a match that would have worked.
    expect(resolveEventId('order-1001')).toBe('order-1001');
    expect(resolveEventId('  order-1001  ')).toBe('  order-1001  ');
  });

  it.each([undefined, '', '   '])(
    'generates an ID for %j rather than sending a blank one',
    (value) => {
      // Pinterest requires a non-empty event_id, so a blank must never reach it.
      expect(resolveEventId(value)).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    }
  );

  it('generates a distinct ID per call', () => {
    // Each generated ID is a new event: retries double-count unless the caller
    // supplies its own stable value.
    expect(resolveEventId(undefined)).not.toBe(resolveEventId(undefined));
  });
});

function captureError(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error('Expected the call to throw, but it did not.');
}
