import { createPiece } from '@activepieces/pieces-framework';
import { PieceCategory } from '@activepieces/shared';
import { createCustomApiCallAction } from '@activepieces/pieces-common';
import { trybookingAuth } from './lib/common/auth';
import { getBooking } from './lib/actions/get-booking';
import { getBookingsByDate } from './lib/actions/get-bookings-by-date';
import { listEvents } from './lib/actions/list-events';
import { getEvent } from './lib/actions/get-event';
import { getTicketScans } from './lib/actions/get-ticket-scans';
import { newBooking } from './lib/triggers/new-booking';
import { newBookingPolling } from './lib/triggers/new-booking-polling';
import { trybookingCommon } from './lib/common/client';

export const trybooking = createPiece({
  displayName: 'TryBooking',
  description:
    'Read events, bookings and ticket scans from your TryBooking account with the Reporting API.',
  minimumSupportedRelease: '0.82.0',
  logoUrl: 'https://cdn.activepieces.com/pieces/trybooking.png',
  categories: [PieceCategory.SALES_AND_CRM, PieceCategory.COMMERCE],
  auth: trybookingAuth,
  authors: ['cavemaann'],
  actions: [
    getBooking,
    getBookingsByDate,
    listEvents,
    getEvent,
    getTicketScans,
    createCustomApiCallAction({
      baseUrl: (auth) =>
        trybookingCommon.reportingBaseUrl(auth?.props.region ?? 'au'),
      auth: trybookingAuth,
      authMapping: async (auth) => ({
        Authorization: `Basic ${Buffer.from(
          `${auth.props.api_key}:${auth.props.secret_key}`
        ).toString('base64')}`,
      }),
    }),
  ],
  triggers: [newBooking, newBookingPolling],
});
