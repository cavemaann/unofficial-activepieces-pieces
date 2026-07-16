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

## Development

```bash
npm run build -- --filter=@cavemaann/piece-pinterest-conversions
npm run test  -- --filter=@cavemaann/piece-pinterest-conversions
```
