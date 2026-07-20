# @cavemaann/piece-pinterest-conversions

Unofficial [Activepieces](https://www.activepieces.com) piece for the
**Pinterest Conversions API** — send server-side web, app, and offline conversion
events to Pinterest.

> Not affiliated with Activepieces or Pinterest.

## Auth

Custom auth with:

- **Conversion Access Token** (`conversion_token`) — secret Bearer token from Pinterest.
- **Ad Account ID** — your Pinterest ad account identifier.

## Actions

- **Send Conversion Event** — build and send a conversion event (user data is SHA-256
  hashed client-side per Pinterest's requirements).
- **Custom API Call** — authenticated passthrough to `https://api.pinterest.com/v5`.

## Sending an event

Three things Pinterest requires, enforced before the request is sent:

- **A customer identifier.** At least one of Email, Mobile Advertising ID, or both
  Client IP Address *and* Client User Agent. Without one the event cannot be
  attributed to anyone.
- **Event Time.** A Unix timestamp in seconds or an ISO 8601 date with a timezone
  (`2026-07-20T10:00:00Z`). Required — it is not defaulted to the time of the run,
  since a conversion is usually recorded after it happened.
- **Event ID**, if you also run the Pinterest tag. Send the same value on both sides
  or the conversion is counted twice. Left empty, one is generated per call, which
  means retries record as separate events.

Identifiers are normalized and hashed for you — enter raw values. A value that is
already a SHA-256 digest is passed through rather than hashed again. Phone numbers
should include the country code; a bare national number cannot be matched.

**Test Mode** validates the whole payload against Pinterest without recording
anything, and returns their messages. Use it to check a new flow, then turn it off.

Other fields are sent as given. Pinterest receives them unhashed and its response
says what it rejected or warned about, so this piece does not second guess a value
it has no way to judge better.

## Development

```bash
npm run build -- --filter=@cavemaann/piece-pinterest-conversions
npm run test  -- --filter=@cavemaann/piece-pinterest-conversions
```
