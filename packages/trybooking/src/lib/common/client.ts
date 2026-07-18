import {
  AppConnectionValueForAuthProperty,
  Property,
} from '@activepieces/pieces-framework';
import {
  AuthenticationType,
  HttpError,
  HttpMethod,
  QueryParams,
  httpClient,
} from '@activepieces/pieces-common';
import { trybookingAuth } from './auth';

async function apiCall<T>({
  auth,
  method,
  version,
  path,
  queryParams,
}: {
  auth: TryBookingAuth;
  method: HttpMethod;
  version: TryBookingApiVersion;
  path: string;
  queryParams?: QueryParams;
}): Promise<T> {
  try {
    const response = await httpClient.sendRequest<T>({
      method,
      url: `${reportingBaseUrl(auth.props.region)}/${version}${path}`,
      authentication: {
        type: AuthenticationType.BASIC,
        username: auth.props.api_key,
        password: auth.props.secret_key,
      },
      queryParams,
    });
    return response.body;
  } catch (error) {
    throw toFriendlyError(error);
  }
}

function reportingBaseUrl(region: string): string {
  return `https://api.trybooking.com/${region}/reporting`;
}

function validateUtcDate(value: string): string {
  const exactDatePattern = /^\d{4}-\d{2}-\d{2}$/;
  const epochMilliSeconds = Date.parse(`${value}T00:00:00.000Z`);
  const normalizedDate = Number.isNaN(epochMilliSeconds)
    ? null
    : new Date(epochMilliSeconds).toISOString().slice(0, 10);

  if (!exactDatePattern.test(value) || normalizedDate !== value) {
    throw new Error(
      'Booking Date must be a real UTC date in yyyy-MM-dd format, for example 2026-07-14.'
    );
  }

  return value;
}

function toFriendlyError(error: unknown): Error {
  if (error instanceof HttpError) {
    const status = error.response.status;
    switch (status) {
      case 400:
        return new Error(
          'Bad Request: TryBooking rejected the request. Check the date format (yyyy-MM-dd) and any IDs you provided.'
        );
      case 401:
        return new Error(
          'Authentication Failed: the API Key or Secret Key is invalid. Regenerate them in Portal → Integration Tools → API Management and reconnect.'
        );
      case 403:
        return new Error(
          'Access Denied: this API key does not have permission for the requested resource, or the region does not match your account.'
        );
      case 404:
        return new Error(
          'Not Found: no matching record exists. Confirm the ID belongs to the connected account and region.'
        );
      case 429:
        return new Error(
          'Rate Limit Exceeded: too many requests to the TryBooking API. Please retry shortly.'
        );
      case 500:
        return new Error(
          'TryBooking Server Error: the Reporting API is temporarily unavailable. Please try again later.'
        );
      default:
        return new Error(`TryBooking API Error (${status}).`);
    }
  }
  return error instanceof Error
    ? error
    : new Error('Unexpected error calling the TryBooking API.');
}

function normalizeEvents(
  body: TryBookingEvent[] | TryBookingEvent | null
): TryBookingEvent[] {
  if (Array.isArray(body)) {
    return body;
  }
  if (body && typeof body === 'object') {
    return [body];
  }
  return [];
}

const eventDropdown = Property.Dropdown({
  displayName: 'Event',
  description: 'The event to look up. Loaded from your TryBooking account.',
  auth: trybookingAuth,
  required: true,
  refreshers: [],
  options: async ({ auth }) => {
    if (!auth) {
      return {
        disabled: true,
        options: [],
        placeholder: 'Connect your TryBooking account first',
      };
    }
    try {
      const body = await apiCall<TryBookingEvent[] | TryBookingEvent>({
        auth,
        method: HttpMethod.GET,
        version: 'v1',
        path: '/event',
      });
      return {
        disabled: false,
        options: normalizeEvents(body).map((event) => ({
          label: event.eventCode
            ? `${event.name} (${event.eventCode})`
            : event.name,
          value: event.eventId,
        })),
      };
    } catch (error) {
      return {
        disabled: true,
        options: [],
        placeholder: 'Could not load events. Check your connection.',
      };
    }
  },
});

const sessionDropdown = Property.Dropdown({
  displayName: 'Session',
  description:
    'The session (a single date/time occurrence) of the selected event.',
  auth: trybookingAuth,
  required: true,
  refreshers: ['eventId'],
  options: async ({ auth, eventId }) => {
    if (!auth) {
      return {
        disabled: true,
        options: [],
        placeholder: 'Connect your TryBooking account first',
      };
    }
    if (!eventId) {
      return {
        disabled: true,
        options: [],
        placeholder: 'Select an event first',
      };
    }
    try {
      const event = await apiCall<TryBookingEvent>({
        auth,
        method: HttpMethod.GET,
        version: 'v1',
        path: `/event/${eventId}`,
      });
      const sessions = event.sessionList ?? [];
      return {
        disabled: false,
        options: sessions.map((session) => ({
          label: session.alternateLabel
            ? `${session.alternateLabel} (${session.eventStartDate})`
            : session.eventStartDate,
          value: session.id,
        })),
      };
    } catch (error) {
      return {
        disabled: true,
        options: [],
        placeholder: 'Could not load sessions. Check the event and connection.',
      };
    }
  },
});

export const trybookingCommon = {
  apiCall,
  reportingBaseUrl,
  normalizeEvents,
  validateUtcDate,
  eventDropdown,
  sessionDropdown,
};

export type TryBookingAuth = AppConnectionValueForAuthProperty<
  typeof trybookingAuth
>;

export type TryBookingSession = {
  id: number;
  eventStartDate: string;
  eventEndDate: string;
  bookingStartDate: string;
  bookingEndDate: string;
  alternateLabel: string;
  description: string;
  sessionStatus: string;
  sessionCapacity: number;
  sessionAvailability: number;
  sessionBookingUrl: string;
  onlineEventLink: string;
};

export type TryBookingEvent = {
  name: string;
  eventId: number;
  eventCode: string;
  description: string;
  venue: string;
  isPublic: boolean;
  isOpen: boolean;
  timeZone: string;
  eventTags: string[];
  bookingUrl: string;
  sessionList: TryBookingSession[];
};

export type TryBookingBooking = {
  bookingUrlId: string | null;
  date: string;
  bookingFirstName: string | null;
  bookingLastName: string | null;
  bookingEmail: string | null;
  bookingPhone: string | null;
  totalAmount: number;
  totalRefundedAmount: number;
  customId: string | null;
  bookingTickets: Array<Record<string, unknown>> | null;
};

export type TryBookingApiVersion = 'v1' | 'v2';
