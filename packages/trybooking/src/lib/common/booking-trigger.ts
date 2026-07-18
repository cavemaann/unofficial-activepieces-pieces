import { DEDUPE_KEY_PROPERTY } from '@activepieces/pieces-framework';
import { TryBookingBooking } from './client';

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const DATE_REQUEST_CONCURRENCY = 5;
const POLLING_OVERLAP_DAYS = 1;
const POLLING_STATE_KEY = 'trybooking_new_booking_polling_state';

function utcDateString(epochMilliSeconds: number): string {
  return new Date(epochMilliSeconds).toISOString().slice(0, 10);
}

function utcDayStart(epochMilliSeconds: number): number {
  return Date.parse(`${utcDateString(epochMilliSeconds)}T00:00:00.000Z`);
}

function bookingKey(booking: TryBookingBooking): string {
  if (booking.bookingUrlId) {
    return booking.bookingUrlId;
  }
  return [
    booking.date,
    booking.bookingEmail ?? '',
    booking.bookingFirstName ?? '',
    booking.bookingLastName ?? '',
    booking.totalAmount,
  ].join('|');
}

function bookingEpochMilliSeconds(booking: TryBookingBooking): number {
  const epochMilliSeconds = Date.parse(booking.date);
  if (Number.isNaN(epochMilliSeconds)) {
    throw new Error(
      `TryBooking returned an invalid date for booking ${bookingKey(booking)}.`
    );
  }
  return epochMilliSeconds;
}

function enumerateUtcDates({
  startEpochMilliSeconds,
  endEpochMilliSeconds,
}: {
  startEpochMilliSeconds: number;
  endEpochMilliSeconds: number;
}): string[] {
  const start = utcDayStart(startEpochMilliSeconds);
  const end = utcDayStart(endEpochMilliSeconds);
  const dates: string[] = [];

  for (let current = start; current <= end; current += DAY_IN_MILLISECONDS) {
    dates.push(utcDateString(current));
  }

  return dates;
}

async function fetchBookingsForDates({
  dates,
  fetchBookings,
}: {
  dates: string[];
  fetchBookings: FetchBookings;
}): Promise<TryBookingBooking[]> {
  let bookings: TryBookingBooking[] = [];

  for (
    let index = 0;
    index < dates.length;
    index += DATE_REQUEST_CONCURRENCY
  ) {
    const dateBatch = dates.slice(index, index + DATE_REQUEST_CONCURRENCY);
    const bookingBatch = await Promise.all(
      dateBatch.map((date) => fetchBookings({ date }))
    );
    bookings = [...bookings, ...bookingBatch.flat()];
  }

  return bookings;
}

function uniqueBookings(bookings: TryBookingBooking[]): TryBookingBooking[] {
  const bookingsById = new Map<string, TryBookingBooking>();
  for (const booking of bookings) {
    bookingsById.set(bookingKey(booking), booking);
  }
  return [...bookingsById.values()];
}

function sortBookingsAscending(
  bookings: TryBookingBooking[]
): TryBookingBooking[] {
  return [...bookings].sort((first, second) => {
    const dateDifference =
      bookingEpochMilliSeconds(first) - bookingEpochMilliSeconds(second);
    return dateDifference !== 0
      ? dateDifference
      : bookingKey(first).localeCompare(bookingKey(second));
  });
}

function createSeenBookingIds(
  bookings: TryBookingBooking[]
): Record<string, number> {
  return Object.fromEntries(
    bookings.map((booking) => [
      bookingKey(booking),
      bookingEpochMilliSeconds(booking),
    ])
  );
}

async function createInitialPollingState({
  nowEpochMilliSeconds,
  fetchBookings,
}: {
  nowEpochMilliSeconds: number;
  fetchBookings: FetchBookings;
}): Promise<BookingPollingState> {
  const todayStart = utcDayStart(nowEpochMilliSeconds);
  const dates = enumerateUtcDates({
    startEpochMilliSeconds:
      todayStart - POLLING_OVERLAP_DAYS * DAY_IN_MILLISECONDS,
    endEpochMilliSeconds: nowEpochMilliSeconds,
  });
  const bookings = uniqueBookings(
    await fetchBookingsForDates({ dates, fetchBookings })
  );

  return {
    lastSuccessfulPollEpochMilliSeconds: nowEpochMilliSeconds,
    seenBookingIds: createSeenBookingIds(bookings),
  };
}

async function pollForNewBookings({
  state,
  nowEpochMilliSeconds,
  fetchBookings,
}: {
  state: BookingPollingState;
  nowEpochMilliSeconds: number;
  fetchBookings: FetchBookings;
}): Promise<BookingPollingResult> {
  const lastSuccessfulPollEpochMilliSeconds = Math.min(
    state.lastSuccessfulPollEpochMilliSeconds,
    nowEpochMilliSeconds
  );
  const dates = enumerateUtcDates({
    startEpochMilliSeconds:
      utcDayStart(lastSuccessfulPollEpochMilliSeconds) -
      POLLING_OVERLAP_DAYS * DAY_IN_MILLISECONDS,
    endEpochMilliSeconds: nowEpochMilliSeconds,
  });
  const bookings = uniqueBookings(
    await fetchBookingsForDates({ dates, fetchBookings })
  );
  const newBookings = sortBookingsAscending(
    bookings.filter(
      (booking) => state.seenBookingIds[bookingKey(booking)] === undefined
    )
  );
  const retentionThreshold =
    utcDayStart(nowEpochMilliSeconds) -
    POLLING_OVERLAP_DAYS * DAY_IN_MILLISECONDS;
  const retainedSeenBookingIds = Object.fromEntries(
    Object.entries(state.seenBookingIds).filter(
      ([, epochMilliSeconds]) => epochMilliSeconds >= retentionThreshold
    )
  );
  const fetchedSeenBookingIds = createSeenBookingIds(
    bookings.filter(
      (booking) => bookingEpochMilliSeconds(booking) >= retentionThreshold
    )
  );

  return {
    bookings: newBookings,
    state: {
      lastSuccessfulPollEpochMilliSeconds: nowEpochMilliSeconds,
      seenBookingIds: {
        ...retainedSeenBookingIds,
        ...fetchedSeenBookingIds,
      },
    },
  };
}

async function getRecentBookings({
  nowEpochMilliSeconds,
  fetchBookings,
}: {
  nowEpochMilliSeconds: number;
  fetchBookings: FetchBookings;
}): Promise<TryBookingBooking[]> {
  const todayStart = utcDayStart(nowEpochMilliSeconds);
  const dates = enumerateUtcDates({
    startEpochMilliSeconds: todayStart - DAY_IN_MILLISECONDS,
    endEpochMilliSeconds: nowEpochMilliSeconds,
  });
  const bookings = uniqueBookings(
    await fetchBookingsForDates({ dates, fetchBookings })
  );

  return sortBookingsAscending(bookings).reverse().slice(0, 5);
}

function parseBookingNotification(
  queryParams: Record<string, string>
): TryBookingBookingNotification {
  const amount = Number.parseFloat(queryParams['amount'] ?? '');
  const ticketCount = Number.parseInt(queryParams['tickets'] ?? '', 10);
  return {
    bookingId: (queryParams['bookingId'] ?? '').trim(),
    eventId: queryParams['eventId'] ?? '',
    customId: queryParams['customId'] ?? '',
    amount: Number.isFinite(amount) ? amount : null,
    ticketCount: Number.isInteger(ticketCount) ? ticketCount : null,
    status: queryParams['status'] ?? '',
  };
}

function processWebhookNotification({
  queryParams,
}: {
  queryParams: Record<string, string>;
}): Array<TryBookingBookingNotification & { [DEDUPE_KEY_PROPERTY]: string }> {
  const status = queryParams['status'];
  if (!status) {
    throw new Error(
      'TryBooking Notify URL is missing the status parameter. Check the trigger setup instructions.'
    );
  }
  if (status !== '1') {
    return [];
  }

  const bookingId = queryParams['bookingId']?.trim();
  if (!bookingId) {
    throw new Error(
      'TryBooking Notify URL is missing the bookingId parameter. Check the trigger setup instructions.'
    );
  }

  return [
    {
      ...parseBookingNotification(queryParams),
      [DEDUPE_KEY_PROPERTY]: bookingId,
    },
  ];
}

export const bookingTriggerUtils = {
  pollingStateKey: POLLING_STATE_KEY,
  enumerateUtcDates,
  createInitialPollingState,
  pollForNewBookings,
  getRecentBookings,
  processWebhookNotification,
};

export type BookingPollingState = {
  lastSuccessfulPollEpochMilliSeconds: number;
  seenBookingIds: Record<string, number>;
};

type BookingPollingResult = {
  bookings: TryBookingBooking[];
  state: BookingPollingState;
};

type FetchBookings = (params: {
  date: string;
}) => Promise<TryBookingBooking[]>;

export type TryBookingBookingNotification = {
  bookingId: string;
  eventId: string;
  customId: string;
  amount: number | null;
  ticketCount: number | null;
  status: string;
};
