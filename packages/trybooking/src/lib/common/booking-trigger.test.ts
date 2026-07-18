import { DEDUPE_KEY_PROPERTY } from '@activepieces/pieces-framework';
import { describe, expect, it, vi } from 'vitest';
import { bookingTriggerUtils, BookingPollingState } from './booking-trigger';
import { TryBookingBooking } from './client';

function booking({
  id,
  date,
}: {
  id: string;
  date: string;
}): TryBookingBooking {
  return {
    bookingUrlId: id,
    date,
    bookingFirstName: 'Jordan',
    bookingLastName: 'Reyes',
    bookingEmail: 'jordan@example.com',
    bookingPhone: '+61 400 000 000',
    totalAmount: 50,
    totalRefundedAmount: 0,
    customId: '',
    bookingTickets: [],
  };
}

describe('bookingTriggerUtils.enumerateUtcDates', () => {
  it('enumerates every UTC date across month boundaries', () => {
    expect(
      bookingTriggerUtils.enumerateUtcDates({
        startEpochMilliSeconds: Date.parse('2026-06-30T23:59:59Z'),
        endEpochMilliSeconds: Date.parse('2026-07-02T00:00:01Z'),
      })
    ).toEqual(['2026-06-30', '2026-07-01', '2026-07-02']);
  });
});

describe('bookingTriggerUtils polling', () => {
  it('seeds yesterday and today without emitting historical bookings', async () => {
    const fetchBookings = vi.fn(async ({ date }: { date: string }) => [
      booking({ id: date, date: `${date}T10:00:00Z` }),
    ]);

    const state = await bookingTriggerUtils.createInitialPollingState({
      nowEpochMilliSeconds: Date.parse('2026-07-15T12:00:00Z'),
      fetchBookings,
    });

    expect(fetchBookings).toHaveBeenCalledTimes(2);
    expect(fetchBookings).toHaveBeenNthCalledWith(1, { date: '2026-07-14' });
    expect(fetchBookings).toHaveBeenNthCalledWith(2, { date: '2026-07-15' });
    expect(Object.keys(state.seenBookingIds)).toEqual([
      '2026-07-14',
      '2026-07-15',
    ]);
  });

  it('backfills a multi-day outage and preserves equal-timestamp bookings', async () => {
    const state: BookingPollingState = {
      lastSuccessfulPollEpochMilliSeconds: Date.parse(
        '2026-07-11T12:00:00Z'
      ),
      seenBookingIds: {
        existing: Date.parse('2026-07-11T10:00:00Z'),
      },
    };
    const bookingsByDate: Record<string, TryBookingBooking[]> = {
      '2026-07-11': [
        booking({ id: 'existing', date: '2026-07-11T10:00:00Z' }),
      ],
      '2026-07-12': [
        booking({ id: 'same-second-a', date: '2026-07-12T09:00:00Z' }),
        booking({ id: 'same-second-b', date: '2026-07-12T09:00:00Z' }),
      ],
      '2026-07-14': [
        booking({ id: 'latest', date: '2026-07-14T20:00:00Z' }),
      ],
    };
    const requestedDates: string[] = [];

    const result = await bookingTriggerUtils.pollForNewBookings({
      state,
      nowEpochMilliSeconds: Date.parse('2026-07-15T01:00:00Z'),
      fetchBookings: async ({ date }) => {
        requestedDates.push(date);
        return bookingsByDate[date] ?? [];
      },
    });

    expect(requestedDates).toEqual([
      '2026-07-10',
      '2026-07-11',
      '2026-07-12',
      '2026-07-13',
      '2026-07-14',
      '2026-07-15',
    ]);
    expect(result.bookings.map((item) => item.bookingUrlId)).toEqual([
      'same-second-a',
      'same-second-b',
      'latest',
    ]);
    expect(result.state.lastSuccessfulPollEpochMilliSeconds).toBe(
      Date.parse('2026-07-15T01:00:00Z')
    );
  });

  it('does not mutate or advance state when a date request fails', async () => {
    const state: BookingPollingState = {
      lastSuccessfulPollEpochMilliSeconds: Date.parse(
        '2026-07-14T12:00:00Z'
      ),
      seenBookingIds: {
        existing: Date.parse('2026-07-14T10:00:00Z'),
      },
    };
    const originalState = structuredClone(state);

    await expect(
      bookingTriggerUtils.pollForNewBookings({
        state,
        nowEpochMilliSeconds: Date.parse('2026-07-15T12:00:00Z'),
        fetchBookings: async ({ date }) => {
          if (date === '2026-07-15') {
            throw new Error('API unavailable');
          }
          return [];
        },
      })
    ).rejects.toThrow('API unavailable');
    expect(state).toEqual(originalState);
  });

  it('rejects invalid booking timestamps before producing new state', async () => {
    const state: BookingPollingState = {
      lastSuccessfulPollEpochMilliSeconds: Date.parse(
        '2026-07-14T12:00:00Z'
      ),
      seenBookingIds: {},
    };

    await expect(
      bookingTriggerUtils.pollForNewBookings({
        state,
        nowEpochMilliSeconds: Date.parse('2026-07-15T12:00:00Z'),
        fetchBookings: async () => [
          booking({ id: 'invalid', date: 'not-a-date' }),
        ],
      })
    ).rejects.toThrow('TryBooking returned an invalid date for booking invalid.');
  });

  it('handles bookings with a null bookingUrlId without crashing', async () => {
    const state: BookingPollingState = {
      lastSuccessfulPollEpochMilliSeconds: Date.parse('2026-07-15T00:00:00Z'),
      seenBookingIds: {},
    };
    const nullIdBooking: TryBookingBooking = {
      ...booking({ id: 'ignored', date: '2026-07-15T10:00:00Z' }),
      bookingUrlId: null,
    };

    const result = await bookingTriggerUtils.pollForNewBookings({
      state,
      nowEpochMilliSeconds: Date.parse('2026-07-15T12:00:00Z'),
      fetchBookings: async ({ date }) =>
        date === '2026-07-15' ? [nullIdBooking] : [],
    });

    expect(result.bookings).toHaveLength(1);
    expect(Object.keys(result.state.seenBookingIds)).toHaveLength(1);
  });
});

describe('bookingTriggerUtils.processWebhookNotification', () => {
  it('parses a successful notification and supplies a stable dedupe key', () => {
    const result = bookingTriggerUtils.processWebhookNotification({
      queryParams: {
        status: '1',
        bookingId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        eventId: '123456',
        amount: '84.50',
        tickets: '2',
        customId: 'crm-1042',
      },
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.[DEDUPE_KEY_PROPERTY]).toBe(
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    );
    expect(result[0]).toMatchObject({
      bookingId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      eventId: '123456',
      customId: 'crm-1042',
      amount: 84.5,
      ticketCount: 2,
      status: '1',
    });
  });

  it('returns empty/null fields when optional tags are absent', () => {
    const result = bookingTriggerUtils.processWebhookNotification({
      queryParams: { status: '1', bookingId: 'BOOK-1' },
    });

    expect(result[0]).toMatchObject({
      bookingId: 'BOOK-1',
      eventId: '',
      customId: '',
      amount: null,
      ticketCount: null,
    });
  });

  it('ignores unsuccessful transactions', () => {
    expect(
      bookingTriggerUtils.processWebhookNotification({
        queryParams: { status: '2', bookingId: 'BOOK-2' },
      })
    ).toEqual([]);
  });

  it('rejects malformed successful notifications', () => {
    expect(() =>
      bookingTriggerUtils.processWebhookNotification({
        queryParams: { bookingId: 'BOOK-3' },
      })
    ).toThrow('missing the status parameter');
    expect(() =>
      bookingTriggerUtils.processWebhookNotification({
        queryParams: { status: '1' },
      })
    ).toThrow('missing the bookingId parameter');
  });
});
