import {
  createTrigger,
  Property,
  TriggerStrategy,
} from '@activepieces/pieces-framework';
import { bookingTriggerUtils } from '../common/booking-trigger';

const setupInstructions = `### Configure TryBooking Notify URL

This trigger needs no connection — TryBooking calls it directly. Your webhook URL is unique and unguessable, so it acts as the shared secret between TryBooking and Activepieces.

**1. Copy your complete Notify URL.** Use the copy button on the box below, then paste it into TryBooking exactly as shown — it already contains your unique webhook address, and the \`[tags]\` are filled in by TryBooking for each booking:

\`\`\`text
{{webhookUrl}}?bookingId=[booking-id]&eventId=[event-id]&amount=[transaction-amount]&tickets=[ticket-count]&status=[status]&customId=[cid]
\`\`\`

**2. Add it in TryBooking.** Open **Integration Tools → Notify URL** for an account-wide default, or set **Notify URL** on an individual event. Paste the URL and save.

Only successful transactions (status \`1\`) start a flow run. TryBooking may deliver a notification more than once; Activepieces uses the Booking ID to suppress immediate duplicates.

This trigger outputs the values TryBooking sends in the Notify URL. To fetch the full customer, ticket and payment details, add a **Get Booking** step and pass it the \`bookingId\`.`;

const sampleData = {
  bookingId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  eventId: '123456',
  customId: 'crm-1042',
  amount: 84.5,
  ticketCount: 2,
  status: '1',
};

export const newBooking = createTrigger({
  name: 'new_booking',
  displayName: 'New Booking',
  description:
    'Fires in real time when TryBooking reports a successful new booking. No connection required.',
  aiMetadata: {
    description:
      'Fires once for each successful TryBooking Notify URL transaction and returns the values TryBooking sends (bookingId, eventId, customId, amount, ticketCount, status). Requires manual Notify URL setup in TryBooking but no connection. Add a Get Booking step (using bookingId) to hydrate full details, or use New Booking (Polling) when webhook setup is unavailable.',
  },
  type: TriggerStrategy.WEBHOOK,
  requireAuth: false,
  props: {
    setupInstructions: Property.MarkDown({ value: setupInstructions }),
  },
  async onEnable() {
    return Promise.resolve();
  },
  async onDisable() {
    return Promise.resolve();
  },
  async test() {
    return [sampleData];
  },
  async run(context) {
    return bookingTriggerUtils.processWebhookNotification({
      queryParams: context.payload.queryParams,
    });
  },
  sampleData,
});
