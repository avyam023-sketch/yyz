# Clannco Property Engagement Platform

Agents turn a buyer enquiry into a personalised property microsite, share it on WhatsApp, and see what the buyer explores before they follow up.

```
New Enquiry → match available homes → Generate Personalised Microsite → Send via WhatsApp
           → buyer opens /p/<token> → engagement timeline → viewing request → agent confirms
```

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui (Radix) · Supabase (Postgres, Auth, Storage, RLS) · Zod · React Hook Form · pdf.js · Recharts · Vitest · Playwright · PGlite (database tests).

---

## 1. Requirements

- Node.js 20.9 or newer (developed on Node 24)
- A Supabase project (free tier is fine)
- Optional: the [Supabase CLI](https://supabase.com/docs/guides/cli) to apply migrations from the terminal

## 2. Install

```bash
npm install
```

`postinstall` copies the pdf.js worker to `public/pdf.worker.min.mjs`. The file is generated, so git ignores it.

## 3. Configure the environment

```bash
cp .env.example .env.local
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Project URL (Settings → API) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | Publishable key. Older projects can use `NEXT_PUBLIC_SUPABASE_ANON_KEY` instead |
| `MICROSITE_TOKEN_SECRET` | yes | `openssl rand -base64 32`. Encrypts stored microsite links |
| `NEXT_PUBLIC_SITE_URL` | recommended | Public origin used in buyer links, e.g. `https://homes.example.com` |
| `SUPABASE_SECRET_KEY` | seed; optional on server | Needed by `npm run seed`. On the server only if you want team invitations or notification emails |
| `RESEND_API_KEY`, `EMAIL_FROM`, `NOTIFICATIONS_WEBHOOK_SECRET` | optional | Notification emails (see §4, "Email notifications") |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | optional | Rate limits shared across server instances |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | seed only | First admin account (password ≥ 12 characters) |
| `E2E_EMAIL`, `E2E_PASSWORD` | tests only | Enables the full agent workflow Playwright test |

Every dashboard query runs as the signed-in user, so Row Level Security applies. The secret key is used only in two places, each of which authorises the request itself first: sending Supabase invitation emails (owners and admins only) and the notification email webhook (shared secret). Buyers reach the database only through four narrowly scoped SQL functions.

Until Supabase is configured, `/dashboard` and `/login` redirect to `/setup`, which lists what is missing. There is no demo login.

## 4. Set up Supabase

1. **Create a project** at supabase.com.
2. **Apply the migrations** in `supabase/migrations/`, oldest first. Either:
   - paste each file into **SQL Editor → New query → Run**, or
   - with the CLI: `npx supabase link --project-ref <ref>` then `npx supabase db push`.

   `20261019120000_initial_schema.sql` creates the tables, constraints, indexes, RLS policies, SQL functions and the `property-media` storage bucket with its upload policies. `20261020090000_team_and_email.sql` adds the team-management functions and email-delivery tracking. `20261022120000_mobile_cover.sql` adds the portrait cover image used by the microsite hero and share image on phones. `20261027120000_price_on_request.sql` adds the per-unit "price on request" option.
3. **Auth settings** (Authentication → Providers → Email): keep Email enabled. For a staff-only tool, turn **off** "Allow new users to sign up" so accounts can only be created by an administrator.
4. **Auth URL configuration**: set Site URL to your deployed origin, e.g. `https://homes.example.com`, and add `https://homes.example.com/auth/confirm` (and `http://localhost:3000/auth/confirm` for development) to **Redirect URLs**.
5. **Email templates** (Authentication → Email Templates). Server-rendered apps need token-hash links. Change the link in two templates:
   - **Invite user**: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite`
   - **Reset password**: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`

   Both land on `/account/set-password`. Supabase's built-in email sender is heavily rate-limited; for real use, configure custom SMTP under Authentication → SMTP Settings.
6. **Storage**: the migration creates the `property-media` bucket (public read, 25 MB limit, images and PDF only). Uploads are only allowed into the uploading user's organisation folder. If your project blocks SQL inserts into `storage.buckets`, create the bucket by hand with those settings, then re-run the four `storage.objects` policies at the end of the migration.

### Seed sample data (development only)

```bash
SEED_ADMIN_EMAIL=you@agency.com SEED_ADMIN_PASSWORD='a-long-passphrase' npm run seed
```

This creates:

- your admin account (already confirmed);
- a **sample** organisation, *Clannco Demo Agency (Sample)*;
- two **fictional** developments, *Example Residences* (Pune) and *Aurelia Heights* (Bengaluru), with 13 units, including reserved and sold ones so matching can be checked;
- a generated sample brochure PDF for each development.

Sample records are stored with `is_sample = true` and shown with a **Sample** badge. The seed creates no enquiries, microsites or engagement: analytics only ever show real activity.

### Team members

Owners and admins manage the team at **Settings → Manage team** (`/dashboard/settings/team`):

- **Send invitation** (needs `SUPABASE_SECRET_KEY` on the server): Supabase creates the account and emails a link to set a password. The person is added to the organisation straight away.
- **Add existing account**: for someone who already has an account in this Supabase project.
- Change roles or remove members. Removing someone unassigns their enquiries; it does not delete their account.

The rules are enforced in SQL, not just the UI:

- only owners can add, change or remove owners;
- an organisation always keeps at least one owner;
- memberships can no longer be inserted or deleted directly.

A signed-in user with no membership sees a "not part of a team yet" page and no data. Agents can reset a forgotten password from the sign-in page.

### Email notifications (optional)

In-app notifications always work. To also email members who switch on **Also email me these notifications** in Settings:

1. Create a [Resend](https://resend.com) API key and verify a sending domain. Set `RESEND_API_KEY`, `EMAIL_FROM`, `SUPABASE_SECRET_KEY`, and `NOTIFICATIONS_WEBHOOK_SECRET` (`openssl rand -hex 32`) on the server.
2. In Supabase: **Database → Webhooks → Create a new hook**:
   - table `notifications`, event **Insert**;
   - type **HTTP Request**, method **POST**;
   - URL `https://<your-site>/api/internal/notifications/email`;
   - HTTP header `Authorization: Bearer <NOTIFICATIONS_WEBHOOK_SECRET>`.

Each notification is claimed atomically before sending, so webhook retries never send twice. The result is stored on the notification:

- `accepted`: the provider took the message. This is **not** proof of delivery, and the UI says so.
- `failed`, with a short error code.
- `skipped`: the member has not opted in.

Emails contain the notification title and a dashboard link, never buyer contact details.

### Shared rate limiting (optional)

Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (Upstash console → REST API) so public endpoint limits are shared by every server instance. Keys are SHA-256 hashed before they leave the server, because they contain IP addresses and microsite tokens. If Redis is unreachable for a second, limits fall back to per-instance memory. The database's own per-microsite limits always apply.

## 5. Run locally

```bash
npm run dev
```

Open <http://localhost:3000>. With sample data, try this:

1. **New Enquiry**: buyer *Ahmed*, mobile `+91 98123 45678`, *Example Residences*, *2BHK*, budget `80L` to `1Cr`.
2. Review the matches. Reserved and sold units are never offered. Units over budget are listed as close alternatives, with the reason shown.
3. **Generate Personalised Microsite**, then **Preview**.
4. **Send via WhatsApp**. WhatsApp opens with Ahmed's number and the message; you press Send yourself. Then click **Mark as Contacted**.
5. Open the link in another browser or a private window to act as the buyer: open a floor plan, the payment plan and the brochure, then request a viewing.
6. Back on the enquiry, the timeline shows the recorded events. Confirm the viewing from *Viewing Requests*.

**Development-only design previews** (they return 404 in production builds) render the buyer pages with sample data and no database:

- `/dev/microsite`
- `/dev/brochure`

## 6. Tests

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # all Vitest suites (unit + database)
npm run test:unit   # phone, WhatsApp, matching, budget, tokens, validation, timezones
npm run test:db     # migration + RLS + RPCs in an in-process Postgres (PGlite)
npm run test:e2e    # Playwright (starts `npm run dev` if nothing is running)
npm run check       # lint + typecheck + tests + production build
```

`test:db` applies the real migrations to PGlite, with a small Supabase shim (`tests/db/supabase-shim.sql`) that stands in for `auth.uid()`, the roles and the storage schema. It covers:

- organisation isolation;
- token lookup, revocation and expiry;
- event deduplication and validation;
- viewing requests;
- status transitions;
- analytics counting;
- team-management rules and once-only email claiming.

It needs no Supabase project.

The Playwright suite has two parts:

- `public.spec.ts` always runs. It covers dashboard access control, invalid links, public endpoint validation, and the mobile layout via the dev preview.
- `agent-workflow.spec.ts` runs the whole workflow above against a seeded project when `E2E_EMAIL` and `E2E_PASSWORD` are set. Otherwise it is skipped.

First run only: `npx playwright install chromium`.

## 7. Deploy to Vercel

1. Push the repository and import it in Vercel. The framework preset is Next.js and needs no build settings.
2. Add environment variables for Production (and Preview if wanted):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `MICROSITE_TOKEN_SECRET`
   - `NEXT_PUBLIC_SITE_URL`

   Add `SUPABASE_SECRET_KEY` only if you want invitations or notification emails, plus the optional email and Upstash variables. Mark secrets as **Sensitive** in Vercel.
3. Deploy. Set the Supabase Auth Site URL to the production origin.
4. Image optimisation allows the Supabase storage host automatically. It is read from `NEXT_PUBLIC_SUPABASE_URL` at build time, so redeploy if the URL changes.

## 8. WhatsApp: what click-to-chat can and cannot do

The platform uses the standard `https://wa.me/<digits>?text=<encoded message>` link.

- It **opens** WhatsApp with the buyer's number and a pre-filled message. It **never sends** anything. The agent reviews the message and presses Send.
- The app records three separate facts:
  - **link generated**;
  - **WhatsApp opened** (the agent clicked the button; nothing more is known);
  - **agent confirmed sent** (the explicit *Mark as Contacted* action).
- **Delivery is never shown as confirmed.** Click-to-chat provides no delivery information.
- An enquiry is not marked *Contacted* just because the WhatsApp button was clicked.
- *Copy link* and *Copy message* are provided as fallbacks.
- No unofficial automation, scraping or browser control is used. Automated sending would require the official WhatsApp Business Platform: a Meta business account, approved message templates and recorded buyer opt-in.

## 9. Security and privacy model

- **Isolation**:
  - every business row has `organisation_id`, and RLS restricts it to members;
  - composite foreign keys `(id, organisation_id)` make cross-organisation references impossible even in buggy code;
  - triggers stop rows from moving between organisations;
  - the "current organisation" cookie is only honoured if the user is a member.
- **Server-side authorisation**:
  - every page and server action calls `requireAuth`/`requireActionAuth`, which re-verifies the user with Supabase Auth;
  - the proxy redirect is a convenience only;
  - users can update only specific columns (for example, never their own role) through column-level grants.
- **Microsite tokens**:
  - 256-bit random values (base64url);
  - the database stores a SHA-256 **hash**, which every public lookup uses, and an AES-256-GCM **ciphertext** so an agent can copy the link again. The key exists only in the server environment;
  - there are no sequential IDs, phone numbers or names in URLs;
  - revoked or expired links, and links for archived enquiries, return no property content.
- **Public data surface**: `get_public_microsite` returns presentation data only. It never includes internal IDs, buyer phone numbers, budgets or agent notes. Properties are referenced by a short random per-microsite `ref`. Prices of homes that are no longer available are withheld.
- **Abuse controls**:
  - per-IP limits in the API routes;
  - per-microsite and per-session limits inside the database;
  - request body size limits;
  - strict Zod schemas with an allow-list for metadata keys.

  The in-memory limiter is per server instance. For multi-region production traffic, back `src/lib/rate-limit.ts` with a shared store such as Upstash Redis.

  Per-IP limits trust the platform's client-IP header (`x-vercel-forwarded-for` on Vercel). If you host elsewhere, make sure your reverse proxy overwrites `x-real-ip` / `x-forwarded-for` rather than passing through what the client sent, or the per-IP limits can be bypassed.
- **Headers**:
  - `/p/*` sends `Referrer-Policy: no-referrer` (so the token never leaks to Google Maps or other links), `Cache-Control: private, no-store` and `X-Robots-Tag: noindex`;
  - all pages set `X-Frame-Options: DENY` and `nosniff`;
  - link-preview metadata is generic and never includes names or prices.
- **Uploads**: type and size are checked in the browser and by the bucket. Paths are random UUIDs inside the organisation's random `media_prefix` folder, and the server rejects references outside it.
- **Team changes** go only through SQL functions that check the caller's role (see "Team members" above).
- **Webhook**: `/api/internal/notifications/email` requires a constant-time-compared bearer secret of at least 32 characters, and returns 503 until email is fully configured.
- **Logging**: server logs record error codes, never request bodies or personal data.

### What is collected from buyers

| Data | Purpose |
| --- | --- |
| Microsite events (opened, property card shown, details / floor plan / payment plan / map / brochure opened, brochure page displayed, download requested, WhatsApp tapped, viewing form started) | Shown to the assigned agent so they can follow up usefully |
| A random per-tab session ID (sessionStorage, cleared when the tab closes) | Counting visits and de-duplicating refreshes |
| Viewing request form contents (name, phone, preferred date and time, chosen home, message) | Arranging the viewing |

No cookies, fingerprinting, IP storage, advertising pixels or third-party analytics are used on buyer pages. The Google Map loads only when the buyer asks for it. A privacy notice on every microsite explains this. "Brochure page displayed" means the viewer showed that page for about a second, nothing more. Analytics use neutral labels ("Recently engaged", "Viewing requested") and never infer purchase intent.

**Unique visits:** distinct `(microsite, session ID)` pairs with a `microsite_opened` event. One person on two devices counts twice. Repeat events from the same session are ignored for 30 minutes (2 minutes for clicks).

## 10. Project layout

```
supabase/migrations/      schema, RLS, SQL functions, storage policies
src/proxy.ts              session refresh + dashboard redirect (Next 16 "proxy")
src/server/               auth context, data access, server actions (server-only)
src/lib/domain/           pure logic: matching, phone, WhatsApp, money, statuses, dates
src/lib/validation/       Zod schemas shared by forms and the server
src/lib/security/         token generation, hashing, encryption
src/app/dashboard/        admin application
src/app/p/[token]/        buyer microsite and brochure viewer
src/app/api/public/       event ingestion and viewing requests
src/components/microsite/ buyer-facing components
scripts/seed.ts           sample data (development only)
tests/                    unit, database (PGlite) and Playwright suites
```

## 11. Not included in this version

- **Calendar sync.** Not implemented. Viewings are managed in *Viewing Requests*.
- **Generated Supabase types.** Run `npx supabase gen types typescript --linked > src/lib/database.types.ts` and pass them to the clients to type queries end-to-end. Row mapping is currently centralised in `src/server/data/mappers.ts`.
