import { createAction } from '@activepieces/pieces-framework';
import { HttpMethod } from '@activepieces/pieces-common';
import { trybookingAuth } from '../common/auth';
import { trybookingCommon, TryBookingEvent } from '../common/client';

export const listEvents = createAction({
  auth: trybookingAuth,
  name: 'list_events',
  displayName: 'List Events',
  description: 'List all events on the connected TryBooking account.',
  audience: 'both',
  aiMetadata: {
    description:
      'Return every event on the connected TryBooking account as an array, each with its sessions. Use to discover event ids and session ids for other actions, or to sync your event catalogue. Read-only.',
    idempotent: true,
  },
  props: {},
  async run(context) {
    const body = await trybookingCommon.apiCall<
      TryBookingEvent[] | TryBookingEvent
    >({
      auth: context.auth,
      method: HttpMethod.GET,
      version: 'v1',
      path: '/event',
    });
    return trybookingCommon.normalizeEvents(body);
  },
});
