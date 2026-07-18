# Unofficial Activepieces Pieces

> **Unofficial** — this project is **not affiliated with, endorsed by, or supported by
> [Activepieces](https://www.activepieces.com)**. It's a personal home for pieces I've
> built after the Activepieces repo said they've temporarily stopped allowing new unsolicited pull requests for the moment.

## What's inside

| Piece | npm package | Status | Description |
| --- | --- | --- | --- |
| [Reddit Conversions](packages/reddit-conversions/README.md) | [`@cavemaann/piece-reddit-conversions`](https://www.npmjs.com/package/@cavemaann/piece-reddit-conversions) | beta · `0.0.1` | Send server-side web, app, and offline conversion events to Reddit (Conversions API v3). |
| [Pinterest Conversions](packages/pinterest-conversions/README.md) | [`@cavemaann/piece-pinterest-conversions`](https://www.npmjs.com/package/@cavemaann/piece-pinterest-conversions) | beta · `0.0.1` | Send server-side web, app, and offline conversion events to Pinterest (Conversions API). |

> **Beta** — both pieces are published and installable, but still early.

## Requirements

To work in this repo:

- Node.js 20+
- npm 11+ — the repo pins `npm@11.6.2` via `packageManager`; run `corepack enable` once and
  the pinned version is used automatically

To *use* a piece, your Activepieces instance must be **0.82.0 or newer** — see
[Installing a piece](#installing-a-piece-in-activepieces).

## Local development

Set up the repo (`corepack enable` makes the pinned `npm@11.6.2` take effect):

```bash
git clone https://github.com/cavemaann/unofficial-activepieces-pieces.git
cd unofficial-activepieces-pieces
corepack enable
npm install
```

Then run any of the workspace tasks:

| Task | What it does |
| --- | --- |
| `npm run build` | Type-checks and compiles each piece to `dist/` (via turbo). |
| `npm run lint` | Runs eslint over every piece. |
| `npm run test` | Runs the unit tests — currently `reddit-conversions` only. |

Scope any task to one piece with a turbo filter:

```bash
npm run build -- --filter=@cavemaann/piece-reddit-conversions
npm run test  -- --filter=@cavemaann/piece-reddit-conversions
```

`npm run build` type-checks and compiles each piece to `dist/`, but that output is not the bundled artifact published to npm.
. Released packages are self-contained bundles (the framework is
inlined, `dependencies: {}`), built separately against the Activepieces CLI. So a green
`npm run build` proves the code compiles, not that a release is reproducible.

### Trying a piece in a real Activepieces instance

Unit tests don't exercise the piece inside the platform. To see one actually run, install
a published version onto an instance (see below) and build a flow with it. There's no
local piece-linking workflow in this repo yet.

## Installing a piece in Activepieces

Both pieces should install from the npm registry onto any Activepieces instance (>0.82.0).

**Before you start:**

- Your instance must be **Activepieces 0.82.0 or newer**. Published builds report a
  minimum supported release of `0.82.0` (the piece framework raises the `0.36.1` declared
  in source), and an older instance will refuse to install.
- You need **platform admin** access to reach the Pieces screen.

**Install:**

1. Go to **Platform Admin → Setup → Pieces** and click **Install Piece**.
2. Leave **Package Type** as **NPM Registry**.
3. **Piece Name** — the npm package, e.g. `@cavemaann/piece-reddit-conversions`.
4. **Piece Version** — an exact version, e.g. `0.0.1`. Must be plain `X.Y.Z`;
   pre-release versions (`0.0.1-rc.0`) are rejected.
5. Click **Install**. The piece appears in the flow builder's piece list.

Installing from the npm registry is the supported path here. The **Packed Archive (.tgz)**
option is greyed out unless your platform has private pieces enabled, and these pieces are
published publicly anyway — so you don't need it.

**Then connect it.** Both pieces use custom auth, so the first time you add the piece to a
flow you'll create a connection. Each piece's README lists the exact credentials:

- [Reddit Conversions](packages/reddit-conversions/README.md) — conversion access token + Pixel ID.
- [Pinterest Conversions](packages/pinterest-conversions/README.md) — conversion access
  token + ad account ID.

## License

[MIT](LICENSE)
