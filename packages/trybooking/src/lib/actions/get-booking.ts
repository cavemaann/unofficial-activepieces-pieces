import { createAction, Property } from '@activepieces/pieces-framework';
import { HttpMethod } from '@activepieces/pieces-common';
import { trybookingAuth } from '../common/auth';
import { trybookingCommon, TryBookingBooking } from '../common/client';

export const getBooking = createAction({
  auth: trybookingAuth,
  name: 'get_booking',
  displayName: 'Get Booking',
  description: 'Retrieve a single booking (transaction) by its ID.',
  audience: 'both',
  aiMetadata: {
    description:
      'Fetch one TryBooking booking by its Booking ID (a UUID in the format xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx, e.g. the id from a New Booking notification). Use when you already have the id and need the customer, ticket and payment detail. To find bookings without an id, use Get Bookings by Date instead.',
    idempotent: true,
  },
  props: {
    bookingId: Property.ShortText({
      displayName: 'Booking ID',
      description:
        'The booking ID, a UUID in the format xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx — e.g. the id from a New Booking notification, or shown in your TryBooking reports.',
      required: true,
    }),
  },
  async run(context) {
    return await trybookingCommon.apiCall<TryBookingBooking>({
      auth: context.auth,
      method: HttpMethod.GET,
      version: 'v1',
      path: `/bookings/${context.propsValue.bookingId}`,
    });
  },
});
