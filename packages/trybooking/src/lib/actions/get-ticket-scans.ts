import { createAction, Property } from '@activepieces/pieces-framework';
import { HttpMethod } from '@activepieces/pieces-common';
import { trybookingAuth } from '../common/auth';
import { trybookingCommon } from '../common/client';

export const getTicketScans = createAction({
  auth: trybookingAuth,
  name: 'get_ticket_scans',
  displayName: 'Get Ticket Scans',
  description:
    'Retrieve the ticket scans (attendance) for an event session.',
  audience: 'both',
  aiMetadata: {
    description:
      "Fetch the barcode scans for one event session, to confirm who attended. 'Attendance' returns a single scan per ticket; 'All' also includes repeat and scan-out events. Match the ticketBarcode field against booked tickets from Get Booking. Read-only.",
    idempotent: true,
  },
  props: {
    eventId: trybookingCommon.eventDropdown,
    sessionId: trybookingCommon.sessionDropdown,
    scanType: Property.StaticDropdown({
      displayName: 'Scan Type',
      description:
        "'Attendance' returns one scan per attended ticket. 'All' includes every scan event, including scan-outs and re-scans.",
      required: true,
      defaultValue: 'attendance',
      options: {
        options: [
          { label: 'Attendance', value: 'attendance' },
          { label: 'All Scans', value: 'all' },
        ],
      },
    }),
  },
  async run(context) {
    const { sessionId, scanType } = context.propsValue;
    return await trybookingCommon.apiCall<TicketScanList>({
      auth: context.auth,
      method: HttpMethod.GET,
      version: 'v2',
      path: `/scans/${sessionId}/${scanType}`,
    });
  },
});

type TicketScanList = {
  sessionId: number;
  totalAttendance?: number;
  listOfTicketScans: Array<{
    ticketBarcode: string;
    ticketScanId: string;
    scanDateTime: string;
    scanEvent: string;
    scanDeviceName: string;
    scanDeviceLocation: string;
    ruleId: string;
  }>;
};
