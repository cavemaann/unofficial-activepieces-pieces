# @cavemaann/piece-reddit-conversions

Unofficial [Activepieces](https://www.activepieces.com) piece for the
**Reddit Conversions API (v3)** — send server-side web, app, and offline conversion
events to Reddit.

> Not affiliated with Activepieces or Reddit.

## Auth

Custom auth with:

- **Conversion Access Token** (`conversion_token`) — secret Bearer token from Reddit Ads.
- **Pixel ID** (`pixel_id`) — your Reddit Ads pixel / advertiser ID.

## Actions

- **Send Conversion Event** — build and send a single conversion event (user data is
  SHA-256 hashed client-side per Reddit's requirements).
- **Custom API Call** — authenticated passthrough to `https://ads-api.reddit.com/api/v3`.

## Development

```bash
npm run build -- --filter=@cavemaann/piece-reddit-conversions
npm run test  -- --filter=@cavemaann/piece-reddit-conversions
```
