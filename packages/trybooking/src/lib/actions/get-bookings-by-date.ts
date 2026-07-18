import { createAction, Property } from '@activepieces/pieces-framework';
import { HttpMethod } from '@activepieces/pieces-common';
import { trybookingAuth } from '../common/auth';
import { trybookingCommon, TryBookingBooking } from '../common/client';

export const getBookingsByDate = createAction({
  auth: trybookingAuth,
  name: 'get_bookings_by_date',
  displayName: 'Get Bookings by Date',
  description: 'List all bookings (transactions) made on a specific date.',
  audience: 'both',
  aiMetadata: {
    description:
      'List every TryBooking booking placed on one UTC calendar date, returned as an array. Use to reconcile sales for a UTC day; use Get Booking when you already have a specific booking id.',
    idempotent: true,
  },
  props: {
    date: Property.ShortText({
      displayName: 'Booking Date',
      description:
        'The UTC date the bookings were made, in yyyy-MM-dd format (e.g. 2026-07-14).',
      required: true,
    }),
  },
  async run(context) {
    const date = trybookingCommon.validateUtcDate(context.propsValue.date);
    return await trybookingCommon.apiCall<TryBookingBooking[]>({
      auth: context.auth,
      method: HttpMethod.GET,
      version: 'v1',
      path: '/bookings',
      queryParams: { date },
    });
  },
});
