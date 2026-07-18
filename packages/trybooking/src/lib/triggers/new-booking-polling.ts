import { createTrigger, TriggerStrategy } from '@activepieces/pieces-framework';
import { HttpMethod } from '@activepieces/pieces-common';
import { trybookingAuth } from '../common/auth';
import {
  bookingTriggerUtils,
  BookingPollingState,
} from '../common/booking-trigger';
import { trybookingCommon, TryBookingBooking } from '../common/client';

const sampleData = {
  bookingUrlId: 'q4Xk2',
  date: '2026-07-14T09:32:11Z',
  bookingFirstName: 'Jordan',
  bookingLastName: 'Reyes',
  bookingEmail: 'jordan.reyes@example.com',
  bookingPhone: '+61 400 000 000',
  totalAmount: 84.5,
  totalCardFee: 2.5,
  totalProcessingFee: 0,
  totalRefundedAmount: 0,
  customId: 'crm-1042',
  bookingTickets: [
    {
      ticketName: 'General Admission',
      seatQuantity: 2,
      sessionId: 1875421,
      eventName: 'Winter Gala 2026',
      eventCode: 'WG26',
      totalTicketPrice: 82,
    },
  ],
};

export const newBookingPolling = createTrigger({
  auth: trybookingAuth,
  name: 'new_booking_polling',
  displayName: 'New Booking (Polling)',
  description:
    'Checks TryBooking periodically for successful new bookings without requiring Notify URL setup.',
  aiMetadata: {
    description:
      'Periodically finds successful TryBooking bookings across the connected account. Use when Notify URL setup is unavailable; one payload represents one hydrated booking and missed polling intervals are backfilled.',
  },
  type: TriggerStrategy.POLLING,
  props: {},
  async test(context) {
    return await bookingTriggerUtils.getRecentBookings({
      nowEpochMilliSeconds: Date.now(),
      fetchBookings: async ({ date }) =>
        trybookingCommon.apiCall<TryBookingBooking[]>({
          auth: context.auth,
          method: HttpMethod.GET,
          version: 'v1',
          path: '/bookings',
          queryParams: { date },
        }),
    });
  },
  async onEnable(context) {
    const state = await bookingTriggerUtils.createInitialPollingState({
      nowEpochMilliSeconds: Date.now(),
      fetchBookings: async ({ date }) =>
        trybookingCommon.apiCall<TryBookingBooking[]>({
          auth: context.auth,
          method: HttpMethod.GET,
          version: 'v1',
          path: '/bookings',
          queryParams: { date },
        }),
    });
    await context.store.put(bookingTriggerUtils.pollingStateKey, state);
  },
  async onDisable() {
    return Promise.resolve();
  },
  async run(context) {
    const state = await context.store.get<BookingPollingState>(
      bookingTriggerUtils.pollingStateKey
    );
    if (!state) {
      throw new Error(
        'New Booking (Polling) is missing its polling state. Disable and re-enable the flow, then try again.'
      );
    }

    const result = await bookingTriggerUtils.pollForNewBookings({
      state,
      nowEpochMilliSeconds: Date.now(),
      fetchBookings: async ({ date }) =>
        trybookingCommon.apiCall<TryBookingBooking[]>({
          auth: context.auth,
          method: HttpMethod.GET,
          version: 'v1',
          path: '/bookings',
          queryParams: { date },
        }),
    });
    await context.store.put(
      bookingTriggerUtils.pollingStateKey,
      result.state
    );
    return result.bookings;
  },
  sampleData,
});
