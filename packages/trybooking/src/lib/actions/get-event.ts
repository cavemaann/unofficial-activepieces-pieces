import { createAction } from '@activepieces/pieces-framework';
import { HttpMethod } from '@activepieces/pieces-common';
import { trybookingAuth } from '../common/auth';
import { trybookingCommon, TryBookingEvent } from '../common/client';

export const getEvent = createAction({
  auth: trybookingAuth,
  name: 'get_event',
  displayName: 'Get Event',
  description: 'Retrieve a single event, including its sessions.',
  audience: 'both',
  aiMetadata: {
    description:
      'Fetch one TryBooking event by id, including its full session list (dates, capacity and availability). Use when you need the sessions or details of a known event; use List Events to browse all events first.',
    idempotent: true,
  },
  props: {
    eventId: trybookingCommon.eventDropdown,
  },
  async run(context) {
    return await trybookingCommon.apiCall<TryBookingEvent>({
      auth: context.auth,
      method: HttpMethod.GET,
      version: 'v1',
      path: `/event/${context.propsValue.eventId}`,
    });
  },
});
