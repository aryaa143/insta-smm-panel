# InstaBoost Panel

A working Instagram SMM (social media marketing) reseller panel: public storefront,
user accounts with a wallet, an order system, and an admin dashboard — built with
Node.js, Express, EJS and SQLite.

**What this is:** a storefront + order/wallet system that resells an **upstream
provider's** API. It does not generate followers/likes/views itself — you plug in
your own provider account (see "Connect your provider" below) and this app handles
everything around it: accounts, pricing, wallet, orders, admin tools, legal pages.

**Please read [`LEGAL-READ-ME-FIRST.md`](./LEGAL-READ-ME-FIRST.md)** before you launch
this publicly — selling engagement services sits in a legal/ToS gray area and a few
things (payment processors, platform terms) are worth knowing going in.

## Features

- **Public site** — landing page with live pricing pulled from your real catalog, FAQ,
  contact, Terms of Service, Privacy Policy and Refund Policy pages (editable starter
  templates, not final legal advice).
- **Accounts** — register/login with hashed passwords, sessions, password change.
- **Wallet** — balance per user, full transaction ledger. No payment gateway is wired
  up yet (you chose to skip that step) — top-ups are manual: a customer submits a
  top-up request with a payment reference, an admin verifies and approves it, and
  the wallet is credited. See "Adding a real payment gateway" below to automate this.
- **Orders** — place an order against any active service; charge is calculated and
  deducted from the wallet; the order is sent to your upstream provider automatically
  if the service is linked to one. Order status can be refreshed from the provider at
  any time, by the customer or an admin.
- **Admin panel** — dashboard stats, manage users (manual wallet adjustments,
  suspend/reactivate), manage services (one-click "Sync from provider" pulls your
  real catalog in, disabled by default so you can review pricing before going live),
  manage orders (sync status, manually set status with automatic refund on
  cancel/fail), approve/reject fund requests, and site settings (branding, currency,
  markup, provider API credentials).

## Quick start

```bash
npm install
cp .env.example .env      # then edit .env - see below
npm run db:init           # creates the SQLite database + your admin account
npm run dev                # http://localhost:3000 (auto-restarts on file changes)
# or: npm start            # for a plain run
```

Log in at `/login` with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` you set in `.env`, then
go to **Admin → Settings** to confirm your provider API details, and **Admin →
Services → Sync from provider** to pull in your real service catalog.

## Connect your provider

In `.env` (or later from **Admin → Settings**):

```
PROVIDER_API_URL=https://your-provider-domain.example/api/v2
PROVIDER_API_KEY=your-provider-api-key
```

This app speaks the de-facto "SMM Panel API" format most providers use
(`action=services|add|status|balance|refill|cancel`, posted as form data with your
key). If your specific provider's field names differ, the **only** file you need to
touch is `src/services/providerApi.js` — everything else calls through that one
module.

Until a provider is connected, services you add manually (Admin → Services, or
directly in the database) without a provider ID will still work — orders for them
are marked "pending" for you to fulfil/update manually.

## Adding a real payment gateway

Wallet top-ups are manual right now (customer submits a reference, admin approves).
To automate it:
1. Pick a gateway (e.g. Razorpay/UPI for India, or Stripe) and check **their**
   acceptable-use policy for SMM/engagement-reselling businesses first — many
   explicitly restrict this category, so it's worth confirming before you integrate.
2. Add the gateway's SDK, create a checkout/order endpoint, and on their webhook
   call `usersModel.adjustBalance(userId, amount, 'deposit', note)` from
   `src/models/users.js` instead of (or alongside) the manual fund-request flow in
   `src/routes/dashboard.js`.

## Project structure

```
src/
  server.js              # app entrypoint, middleware, routes mount
  config/                # db connection, schema.sql, initdb.js (first-run setup)
  models/                # all SQL lives here (users, services, orders, ...)
  middleware/auth.js      # session auth + admin guard
  services/providerApi.js # the one file for upstream provider integration
  routes/                 # auth.js, public.js, dashboard.js (user area), admin.js
  views/                  # EJS templates (public/, dashboard/, admin/, partials/)
data/                      # SQLite database + session store (created on first run)
```

## Deploying

This is a normal Node.js app — deploy it anywhere that runs Node 18+ (a VPS, Render,
Railway, Fly.io, etc.). A few things to change for production:

- Set `NODE_ENV=production` and a long random `SESSION_SECRET` in `.env`.
- Put a real domain in `APP_URL` and serve over HTTPS (session cookies are marked
  `secure` automatically in production, which requires HTTPS).
- The SQLite file in `data/` is fine for a single server; for multi-server setups,
  move to Postgres/MySQL (the model files in `src/models/` are the only place that
  would need rewriting — the SQL is plain and not SQLite-specific beyond the schema).
- Tailwind is loaded from the CDN (`cdn.tailwindcss.com`) for simplicity. For
  production, consider compiling it with the Tailwind CLI instead (smaller page
  weight, no console warning) — the class names in the views won't need to change.
- Put the app behind a reverse proxy (nginx/Caddy) or a platform that handles
  TLS termination for you.

## Security notes already built in

- Passwords hashed with bcrypt, never stored in plain text.
- Sessions are httpOnly cookies backed by a server-side SQLite session store.
- Login/registration are rate-limited (20 attempts / 15 min per IP).
- `helmet` sets standard security headers.
- All SQL uses parameterised queries (via `better-sqlite3`) — no string-built SQL.
- Admin routes are guarded by both "logged in" and "role = admin" checks.
