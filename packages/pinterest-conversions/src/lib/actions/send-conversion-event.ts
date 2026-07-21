import { createAction, Property } from '@activepieces/pieces-framework';
import { randomUUID } from 'crypto';
import { pinterestConversionsAuth } from '../common/auth';
import {
  ConversionEvent,
  pinterestConversionsClient,
} from '../common/client';
import {
  ConversionEventProps,
  PINTEREST_ACTION_SOURCE_OPTIONS,
  PINTEREST_EVENT_OPTIONS,
  parseConversionEventProps,
} from '../common/event-schema';
import { identityHashing } from '../common/hashing';

export const sendConversionEvent = createAction({
  auth: pinterestConversionsAuth,
  name: 'send_conversion_event',
  displayName: 'Send Conversion Event',
  description:
    'Send a single web, app, or offline conversion event to Pinterest via the Conversions API.',
  audience: 'both',
  aiMetadata: {
    description:
      'Send one server-side conversion event (checkout, lead, page_visit, etc.) to Pinterest for the connected ad account. Customer identifiers such as email and phone are automatically normalized and SHA-256 hashed. Provide the same event_id here as on the Pinterest tag to deduplicate; each call otherwise records a new event, so retries with a fresh event_id double-count. Use Test Mode to validate the payload without recording.',
    idempotent: false,
  },
  props: {
    event_name: Property.StaticDropdown({
      displayName: 'Event Name',
      description: 'The type of conversion that occurred.',
      required: true,
      options: {
        options: PINTEREST_EVENT_OPTIONS,
      },
    }),
    action_source: Property.StaticDropdown({
      displayName: 'Action Source',
      description: 'Where the conversion happened.',
      required: true,
      options: {
        options: PINTEREST_ACTION_SOURCE_OPTIONS,
      },
    }),
    event_time: Property.ShortText({
      displayName: 'Event Time',
      description:
        'When the event happened, as a Unix timestamp in seconds or an ISO 8601 date with a timezone (e.g. "2026-07-20T10:00:00Z").',
      required: true,
    }),
    event_id: Property.ShortText({
      displayName: 'Event ID',
      description:
        'Unique ID used to deduplicate this event against the Pinterest tag. Use the same value on both sides. Leave empty to generate one automatically.',
      required: false,
    }),
    event_source_url: Property.ShortText({
      displayName: 'Event Source URL',
      description: 'The URL where a web conversion happened.',
      required: false,
    }),
    opt_out: Property.Checkbox({
      displayName: 'Opt Out',
      description:
        'Whether the user opted out of tracking / ad personalization for this event.',
      required: false,
    }),
    opt_out_type: Property.ShortText({
      displayName: 'Opt Out Type',
      description:
        'Flags for different privacy rights laws to opt out users of sharing personal information. Separate values with commas.',
      required: false,
    }),
    customer_info: Property.MarkDown({
      value:
        '### Customer Information\nProvide at least **one** of: Email, Mobile Advertising ID, or both Client IP Address **and** Client User Agent. Personal identifiers are automatically normalized and SHA-256 hashed before sending — enter the raw values.',
    }),
    email: Property.ShortText({
      displayName: 'Email',
      description: 'Customer email address. Hashed automatically.',
      required: false,
    }),
    phone: Property.ShortText({
      displayName: 'Phone Number',
      description:
        'Customer phone number in E.164 format (e.g. "+447700900123"). Hashed automatically (symbols and spaces are stripped). A national-format number, or one written with the trunk zero in brackets like "+44 (020)", will not match.',
      required: false,
    }),
    first_name: Property.ShortText({
      displayName: 'First Name',
      required: false,
    }),
    last_name: Property.ShortText({
      displayName: 'Last Name',
      required: false,
    }),
    city: Property.ShortText({
      displayName: 'City',
      required: false,
    }),
    state: Property.ShortText({
      displayName: 'State',
      description: 'Two-letter state/region code (e.g. "ca").',
      required: false,
    }),
    zip: Property.ShortText({
      displayName: 'ZIP Code',
      description:
        'Numeric ZIP code. Pinterest accepts digits only; symbols and spaces are removed before hashing.',
      required: false,
    }),
    country: Property.ShortText({
      displayName: 'Country',
      description: 'Two-letter ISO-3166 country code (e.g. "us").',
      required: false,
    }),
    gender: Property.StaticDropdown({
      displayName: 'Gender',
      required: false,
      options: {
        options: [
          { label: 'Female', value: 'f' },
          { label: 'Male', value: 'm' },
          { label: 'Non-binary', value: 'n' },
        ],
      },
    }),
    date_of_birth: Property.ShortText({
      displayName: 'Date of Birth',
      description: 'Format YYYYMMDD (e.g. "19901225"). Hashed automatically.',
      required: false,
    }),
    external_id: Property.ShortText({
      displayName: 'External ID',
      description:
        'Your own unique identifier for the user (e.g. loyalty or account ID). Hashed automatically.',
      required: false,
    }),
    maid: Property.ShortText({
      displayName: 'Mobile Advertising ID (MAID)',
      description:
        "The user's GAID (Android) or IDFA (iOS). Hashed automatically.",
      required: false,
    }),
    client_ip_address: Property.ShortText({
      displayName: 'Client IP Address',
      description: "The user's IP address (IPv4 or IPv6). Sent unhashed.",
      required: false,
    }),
    client_user_agent: Property.ShortText({
      displayName: 'Client User Agent',
      description: "The user's browser user-agent string. Sent unhashed.",
      required: false,
    }),
    click_id: Property.ShortText({
      displayName: 'Click ID',
      description:
        'The value of the _epik cookie or the epik query parameter from the landing URL.',
      required: false,
    }),
    partner_id: Property.ShortText({
      displayName: 'Partner ID',
      description: 'A third-party partner identifier (e.g. RampID).',
      required: false,
    }),
    event_details: Property.MarkDown({
      value: '### Event Details (optional)',
    }),
    currency: Property.ShortText({
      displayName: 'Currency',
      description: 'ISO-4217 currency code (e.g. "USD"). Defaults to the ad account currency.',
      required: false,
    }),
    value: Property.Number({
      displayName: 'Value',
      description: 'Total value of the event (e.g. order total). Recommend pre-tax, pre-shipping.',
      required: false,
    }),
    content_ids: Property.Array({
      displayName: 'Content IDs',
      description: 'Product IDs associated with the event.',
      required: false,
    }),
    content_name: Property.ShortText({
      displayName: 'Content Name',
      required: false,
    }),
    content_category: Property.ShortText({
      displayName: 'Content Category',
      required: false,
    }),
    content_brand: Property.ShortText({
      displayName: 'Content Brand',
      required: false,
    }),
    num_items: Property.Number({
      displayName: 'Number of Items',
      description: 'Total number of products in the event.',
      required: false,
    }),
    order_id: Property.ShortText({
      displayName: 'Order ID',
      description: 'Helps Pinterest deduplicate events. Recommended for checkouts.',
      required: false,
    }),
    search_string: Property.ShortText({
      displayName: 'Search String',
      description: 'The search term for a search event.',
      required: false,
    }),
    app_device: Property.MarkDown({
      value: '### App & Device (optional)',
    }),
    app_id: Property.ShortText({
      displayName: 'App ID',
      description: 'The app store app ID.',
      required: false,
    }),
    app_name: Property.ShortText({
      displayName: 'App Name',
      description: 'Name of the app.',
      required: false,
    }),
    app_version: Property.ShortText({
      displayName: 'App Version',
      description: 'Version of the app.',
      required: false,
    }),
    device_brand: Property.ShortText({
      displayName: 'Device Brand',
      description: "Brand of the user's device.",
      required: false,
    }),
    device_carrier: Property.ShortText({
      displayName: 'Device Carrier',
      description: "The user's device mobile carrier.",
      required: false,
    }),
    device_model: Property.ShortText({
      displayName: 'Device Model',
      description: "Model of the user's device.",
      required: false,
    }),
    language: Property.ShortText({
      displayName: 'Language',
      description:
        "Two-character ISO-639-1 language code indicating the user's language.",
      required: false,
    }),
    os_version: Property.ShortText({
      displayName: 'OS Version',
      description: 'Version of the device operating system.',
      required: false,
    }),
    // A dropdown rather than a checkbox: this is a fact about the device, and
    // an unticked box would assert "not on wifi" for every event where nobody
    // considered the question. Leaving it empty says nothing instead.
    wifi: Property.StaticDropdown({
      displayName: 'Wi-Fi',
      description:
        'Whether the user device was connected to wifi. Leave empty if unknown.',
      required: false,
      options: {
        options: [
          { label: 'Yes', value: 'true' },
          { label: 'No', value: 'false' },
        ],
      },
    }),
    device_type: Property.ShortText({
      displayName: 'Device Type',
      description: "Type of the user's device.",
      required: false,
    }),
    advanced: Property.MarkDown({
      value: '### Advanced (optional)',
    }),
    partner_name: Property.ShortText({
      displayName: 'Partner Name',
      description:
        'For third parties sending on behalf of an advertiser. Lowercase "ss-partnername".',
      required: false,
    }),
    test_mode: Property.Checkbox({
      displayName: 'Test Mode',
      description:
        'When enabled, the event is validated but NOT recorded. Use to verify your setup, then turn off for live events.',
      required: false,
      defaultValue: false,
    }),
  },
  async run(context) {
    const props = parseConversionEventProps(context.propsValue);

    const userData = buildUserData(props);
    const customData = buildCustomData(props);

    const event: ConversionEvent = {
      event_name: props.event_name,
      action_source: props.action_source,
      event_time: props.event_time,
      event_id: resolveEventId(props.event_id),
      // Already trimmed by the schema, and blanks arrive as undefined.
      ...(props.event_source_url
        ? { event_source_url: props.event_source_url }
        : {}),
      ...(props.opt_out == null ? {} : { opt_out: props.opt_out }),
      ...(notBlank(props.partner_name)
        ? { partner_name: props.partner_name.trim() }
        : {}),
      ...buildAppDeviceData(props),
      ...buildAppInfo(props),
      // Boolean, so it cannot ride along in the string-typed builder above.
      ...(props.wifi == null ? {} : { wifi: props.wifi }),
      user_data: userData,
      ...(Object.keys(customData).length > 0 ? { custom_data: customData } : {}),
    };

    const response = await pinterestConversionsClient.sendEvents({
      conversionToken: context.auth.props.conversion_token,
      adAccountId: context.auth.props.ad_account_id,
      events: [event],
      test: props.test_mode ?? false,
    });

    if (response.num_events_processed < response.num_events_received) {
      const reasons = response.events
        .filter((e) => e.status === 'failed')
        .map((e) => e.error_message)
        .filter(notBlank);
      throw new Error(
        reasons.length > 0
          ? `Pinterest did not process the event: ${reasons.join('; ')}`
          : 'Pinterest did not process the event. Check the ad account, token, and event fields.'
      );
    }

    return response;
  },
});

function notBlank(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Pinterest requires a non-empty `event_id`, so a blank one is replaced rather
 * than passed along. A generated ID is unique per call, which means retries are
 * recorded as separate events — supply your own to deduplicate.
 *
 * A supplied ID is sent verbatim, deliberately without trimming. Pinterest
 * matches it against whatever the Pinterest tag sent and documents no
 * normalization for it, so trimming would be a guess about the browser side: if
 * the tag sent " order-1001 ", sending "order-1001" breaks the match and the
 * conversion double-counts. Whitespace-only is still treated as absent — that
 * classifies a missing value rather than rewriting a present one.
 */
export function resolveEventId(value: string | undefined): string {
  return notBlank(value) ? value : randomUUID();
}

function passthrough(value: string | undefined): string | undefined {
  return notBlank(value) ? value.trim() : undefined;
}

/**
 * Like `passthrough`, but keeps the value exactly as given.
 *
 * For keys Pinterest matches against a value sent from somewhere else, where
 * trimming one side of the pair is what breaks the match. A blank is still
 * treated as absent — that classifies a missing value rather than editing a
 * present one. Same reasoning as `resolveEventId`.
 */
function verbatim(value: string | undefined): string | undefined {
  return notBlank(value) ? value : undefined;
}

export function buildUserData(
  props: ConversionEventProps
): Record<string, unknown> {
  const hashedArray = (value: string | undefined): string[] | undefined => {
    return undefined === value ? undefined : wrap(value);
  };
  const userData: Record<string, unknown> = {
    em: hashedArray(identityHashing.email(props.email)),
    ph: hashedArray(identityHashing.phone(props.phone)),
    fn: hashedArray(identityHashing.firstName(props.first_name)),
    ln: hashedArray(identityHashing.lastName(props.last_name)),
    ct: hashedArray(identityHashing.city(props.city)),
    st: hashedArray(identityHashing.state(props.state)),
    zp: hashedArray(identityHashing.zip(props.zip)),
    country: hashedArray(identityHashing.country(props.country)),
    ge: hashedArray(identityHashing.gender(props.gender)),
    db: hashedArray(identityHashing.dateOfBirth(props.date_of_birth)),
    external_id: hashedArray(identityHashing.externalId(props.external_id)),
    hashed_maids: hashedArray(identityHashing.maid(props.maid)),
    client_ip_address: passthrough(props.client_ip_address),
    client_user_agent: passthrough(props.client_user_agent),
    click_id: passthrough(props.click_id),
    partner_id: passthrough(props.partner_id),
  };
  return compact(userData);
}

/**
 * Flat app and device fields, sent at the top level of the event rather than
 * inside `user_data`.
 */
export function buildAppDeviceData(
  props: ConversionEventProps
): Record<string, string> {
  return compact({
    app_id: passthrough(props.app_id),
    app_name: passthrough(props.app_name),
    app_version: passthrough(props.app_version),
    device_brand: passthrough(props.device_brand),
    device_carrier: passthrough(props.device_carrier),
    device_model: passthrough(props.device_model),
    device_type: passthrough(props.device_type),
    language: passthrough(props.language),
    os_version: passthrough(props.os_version),
  }) as Record<string, string>;
}

/**
 * `app_id`, `app_name` and `app_version` nested under `app_info`, duplicating
 * what `buildAppDeviceData` sends flat.
 *
 * Pinterest documents both shapes: these three exist at the top level and again
 * as children of `app_info`, under the same keys. Which one the ingest pipeline
 * reads is not stated, so both carry the value rather than betting on one.
 *
 * Note that `device_info` is not the same case. Its children are `brand`,
 * `carrier`, `model` and `type` — unprefixed, and so distinct fields from the
 * top-level `device_brand`, `device_carrier`, `device_model` and `device_type`
 * this piece sends. There is nothing to duplicate there.
 *
 * `app_info` takes six further fields (`app_package_name`, `app_store`,
 * `install_time`, `user_agent`, `window_height`, `window_width`) that this
 * piece does not collect.
 */
export function buildAppInfo(props: ConversionEventProps): {
  app_info?: { app_id?: string; app_name?: string; app_version?: string };
} {
  const app_info = compact({
    app_id: passthrough(props.app_id),
    app_name: passthrough(props.app_name),
    app_version: passthrough(props.app_version),
  });
  return Object.keys(app_info).length > 0 ? { app_info } : {};
}

export function buildCustomData(
  props: ConversionEventProps
): Record<string, unknown> {
  const contentIds = (props.content_ids ?? [])
    .map((id) => String(id).trim())
    .filter((id) => id.length > 0);
  const customData: Record<string, unknown> = {
    currency: passthrough(props.currency),
    value: props.value == null ? undefined : String(props.value),
    content_ids: contentIds.length > 0 ? contentIds : undefined,
    content_name: passthrough(props.content_name),
    content_category: passthrough(props.content_category),
    content_brand: passthrough(props.content_brand),
    num_items: props.num_items,
    opt_out_type: passthrough(props.opt_out_type),
    order_id: verbatim(props.order_id),
    search_string: passthrough(props.search_string),
  };
  return compact(customData);
}

function wrap(value: string): string[] {
  return [value];
}

function compact(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    )
  );
}
