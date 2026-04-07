# VoucherVault — Cloudflare Worker Deep-Link Importer

This directory contains the Cloudflare Worker that powers the public deep-link importing service for self-hosted VoucherVault instances.

It lets anyone craft a special URL that, when opened, guides the recipient through importing a voucher, gift card, coupon or loyalty card into **their own** self-hosted VoucherVault — without the worker ever touching their vault or storing any data.

---

## How it works

```
Link creator
    │
    │  https://vouchervault-linker.lrvt.de/create-item
    │                                 #name=Foo&code=ABC123&type=giftcard
    │                                 └─── hash fragment (never sent to server) ───┘
    ▼
Cloudflare Worker
    │  Serves a static HTML page.
    │  Worker request logs only see:  GET /create-item  (no sensitive data)
    ▼
Browser (client-side JS)
    │  Reads window.location.hash and parses it as URLSearchParams.
    │  Displays a preview of the item to import.
    │  User enters their self-hosted VoucherVault URL.
    │  URL is saved in localStorage for next time.
    ▼
Self-hosted VoucherVault  (e.g. https://vault.example.com)
    │  Browser redirects to:
    │  https://vault.example.com/items/create/?name=Foo&code=ABC123&type=giftcard
    │                                          └── converted back to GET params ──┘
    ▼
User logs in → reviews the pre-filled create-item form → confirms manually
```

### Why URL fragments (#)?

URL **fragments** (the `#...` part) are a browser-only concept. They are **never included in HTTP requests**, which means:

- The Cloudflare Worker never sees the voucher data. It cannot appear in request logs, analytics, or any server-side audit trail.
- The sensitive data (codes, values, names) stays entirely on the client side.
- The self-hosted VoucherVault instance still receives the data as normal GET parameters, so its `create-item` view requires **no changes**.

---

## Crafting a deep-link

The base URL is the public worker URL (e.g. `https://vouchervault-linker.lrvt.de`).

The path can be anything (e.g. `/create-item`) — the worker always redirects to `/items/create/` on the target instance regardless.

All voucher data goes into the **hash fragment** as URL-encoded query parameters:

```
https://vouchervault-linker.lrvt.de/create-item#<param>=<value>&<param>=<value>
```

### Supported parameters

These map directly to the VoucherVault create-item form fields:

| Parameter | Form field | Notes |
|---|---|---|
| `name` | Name | Display name of the item |
| `issuer` | Issuer | Company or store that issued the voucher |
| `type` | Type | `giftcard`, `coupon`, `voucher`, `loyaltycard` |
| `code` / `redeem_code` | Redeem code | The barcode / voucher code |
| `code_type` | Code type | `qrcode`, `code128`, `ean13`, etc. |
| `pin` | PIN | Optional PIN/security code |
| `value` | Value | Monetary or percentage value |
| `value_type` | Value type | `money`, `percentage`, `multiplier` |
| `issue_date` | Issue date | `YYYY-MM-DD` format |
| `expiry_date` | Expiry date | `YYYY-MM-DD` format |
| `description` | Description | Free-text description |
| `logo_slug` / `logo` | Logo | logo.dev slug (e.g. `amazon`) |
| `tile_color` / `color` | Tile colour | Hex colour (e.g. `%23ff5733` for `#ff5733`) |

### Examples

Minimal — just a gift card code:
```
https://vouchervault-linker.lrvt.de/create-item#name=Amazon&type=giftcard&code=ABC-1234-XYZ
```
This will redirect to: `https://myvault.example.com/items/create/?name=Amazon&type=giftcard&code=ABC-1234-XYZ`

Full example:
```
https://vouchervault-linker.lrvt.de/create-item#name=Amazon+Gift+Card&issuer=Amazon&type=giftcard&code=ABC-1234-XYZ&code_type=qrcode&value=25&description=Giftcard%20from%20grandma%20for%20my%2018th%20birthday&expiry_date=2026-12-31&logo_slug=amazon.com&pin=12345&tile_color=%234154f1
```

> **Note:** URL-encode special characters in values. Spaces can be `+` or `%20`. The `#` character in a hex colour must be encoded as `%23`.

---

## User experience

When a recipient opens a deep-link:

1. The worker serves an HTML page that parses the hash fragment client-side.
2. The page shows a preview of the item to be imported (name, code, type).
3. The user is prompted to enter their VoucherVault instance URL. This URL is saved in `localStorage` so they only need to enter it once.
4. Clicking **Continue & Import** redirects the browser to their instance at `/items/create/?...` with the data converted back to GET parameters.
5. The user must be logged in to their vault. The create-item form is pre-filled but **nothing is saved automatically** — the user reviews and confirms.

---

## Deploying to Cloudflare Workers

### Prerequisites

- A [Cloudflare account](https://dash.cloudflare.com/) (free tier is sufficient)
- A domain managed on Cloudflare (optional)

### Manual deployment via dashboard

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com/) → **Workers & Pages** → **Create application** → **Create Worker**.
2. Paste the contents of `cloudflare-worker.js` into the online editor.
3. Click **Deploy**.

---

## Security considerations

| Concern | How it is addressed |
|---|---|
| Worker sees sensitive voucher data | **No** — data is only in the hash fragment, which is never sent to the server |
| Worker stores anything | **No** — the worker is stateless and serves only a static HTML page |
| Worker can access the user's vault | **No** — it only redirects; it has no credentials and makes no requests to the vault |
| Instance URL is sent to the worker | **No** — the instance URL is entered client-side and used only to build the redirect |
| Data is stored persistently | Only the **instance URL** is saved in the user's own `localStorage` for convenience; no voucher data is ever stored anywhere |

The worker acts purely as a **dumb redirect page** — it never processes, logs, or forwards any voucher data.
