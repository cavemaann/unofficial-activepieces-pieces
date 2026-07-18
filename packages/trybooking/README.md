# @cavemaann/piece-trybooking

Unofficial [Activepieces](https://www.activepieces.com) piece for the
**TryBooking Reporting API** — read events, bookings and ticket scans from your
TryBooking account.

> Not affiliated with Activepieces or TryBooking.

## Auth

Custom auth with:

- **API Key** (`api_key`) — the Key from Portal → Integration Tools → API Management.
- **Secret Key** (`secret_key`) — shown only once, when you generate the API Key.
- **Region** — `au`, `nz`, `uk` or `us`. TryBooking runs a separate system per region;
  pick the one you sign in to.

The keys are sent as HTTP Basic credentials (Key = username, Secret Key = password) and
grant **read access only**.

## Actions

- **Get Booking** — fetch one booking by its Booking ID (a UUID).
- **Get Bookings by Date** — list the bookings made on a given UTC date (`yyyy-MM-dd`).
- **List Events** — list the events in your account.
- **Get Event** — fetch one event, including its sessions.
- **Get Ticket Scans** — fetch the ticket scans (attendance) for an event session.
- **Custom API Call** — authenticated passthrough to the regional Reporting API base.

## Triggers

- **New Booking** (webhook) — fires in real time from TryBooking's Notify URL.
  **Requires no connection**: it emits the values TryBooking puts in the Notify URL
  (`bookingId`, `eventId`, `customId`, `amount`, `ticketCount`, `status`). Pair it with a
  **Get Booking** step to hydrate full customer, ticket and payment detail.

  Set the Notify URL in TryBooking under **Integration Tools → Notify URL** (account-wide)
  or on an individual event. The trigger's setup panel shows the exact URL to paste.
  Only successful transactions (`status=1`) start a flow run; duplicate deliveries are
  suppressed by Booking ID.

- **New Booking (Polling)** — checks periodically for new bookings. Use this when you
  can't configure a Notify URL. Requires a connection.

## Development

```bash
npm run build -- --filter=@cavemaann/piece-trybooking
npm run test  -- --filter=@cavemaann/piece-trybooking
```
