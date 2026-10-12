# Lumen Studio

A modern, mobile-responsive website and admin dashboard for a photography studio.
Built with **plain HTML, CSS, and JavaScript** (no build step, no framework) and
backed by **Supabase** for auth, database, storage, and transactional email.

The site runs in two modes:

- **Demo mode (default)** — with no Supabase credentials set, the whole site
  runs off seeded `localStorage` data. Every page, form, gallery upload, and the
  full admin dashboard work immediately, so you can open `index.html` and click
  around with zero setup.
- **Live mode** — add your Supabase URL + anon key to `js/config.js` and the
  exact same code talks to your real Supabase project instead.

---

## Table of contents

1. [Features](#features)
2. [Tech stack](#tech-stack)
3. [Project structure](#project-structure)
4. [Quick start (demo mode)](#quick-start-demo-mode)
5. [Going live with Supabase](#going-live-with-supabase)
6. [Database schema](#database-schema)
7. [Data-access API (`window.LumenStore`)](#data-access-api-windowlumenstore)
8. [Edge functions & email](#edge-functions--email)
9. [Reminder system](#reminder-system)
10. [Environment variables](#environment-variables)
11. [Deployment](#deployment)
12. [Costs & free-tier limits](#costs--free-tier-limits)
13. [Test plan](#test-plan)
14. [Accessibility & SEO](#accessibility--seo)
15. [Security notes](#security-notes)

---

## Features

**Public site**

- **Home** — parallax layered hero, film-grain overlay, scroll-reveal sections, featured work.
- **About** — studio story, approach, and process.
- **Gallery** — responsive grid, tag filters, lazy-loaded images, and an accessible lightbox with keyboard navigation.
- **Services** — three package cards (Standard / Professional / Premium) that scale on hover and open a detail modal on click, plus a **Custom Package** CTA that opens a pre-filled WhatsApp chat.
- **Contact / Booking** — validated booking form with inline success/error feedback; each submission creates a booking, a dashboard notification, and (in live mode) a confirmation email to the client and an alert to the studio.

**Admin dashboard** (`admin.html`)

- Email/password login (Supabase Auth in live mode; a fixed demo credential otherwise).
- **Gallery CRUD** — add/edit/delete works with image upload, title, description, tags, date, and price.
- **Packages** — edit package names, prices, descriptions, and feature lists.
- **Bookings** — list view with status changes, plus a **calendar view** of upcoming shoots.
- **Reminders** — configurable lead time (days / weeks / months) that drives dashboard pop-ups and scheduled email reminders.
- **To-dos** — task list with Pending/Completed toggle.
- **Notifications** — live feed of new bookings and reminders, with read/unread state.

---

## Tech stack

| Layer      | Choice                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------- |
| Markup     | Static multi-page HTML5                                                                       |
| Styling    | One hand-written stylesheet (`css/styles.css`), CSS custom properties, no framework           |
| Behavior   | Vanilla ES modules-free JS (IIFE modules on `window`)                                         |
| Animation  | CSS transitions, Web Animations API, `IntersectionObserver`, `requestAnimationFrame` parallax |
| Backend    | Supabase — Postgres, Auth, Storage, Edge Functions (Deno)                                     |
| Email      | SendGrid HTTP API (preferred) or generic SMTP via denomailer                                  |
| Scheduling | Supabase scheduled function / `pg_cron`                                                       |

There is **no build step**. The site is a folder of static files you can open
directly or serve with any static host.

---

## Project structure

```
lumen-studio/
├── index.html              Home
├── about.html              About
├── gallery.html            Gallery + lightbox
├── services.html           Packages + modal + WhatsApp CTA
├── contact.html            Booking form
├── admin.html              Admin dashboard (noindex)
├── css/
│   └── styles.css          Full design system + all page styles
├── js/
│   ├── config.js           window.LUMEN_CONFIG (Supabase creds, bucket, WhatsApp)
│   ├── supabaseClient.js   Creates window.sb when configured (anon key only)
│   ├── store.js            window.LumenStore — the ONLY data layer (demo + live)
│   ├── main.js             Shared UI: nav, grain overlay, reveals, parallax
│   ├── gallery.js          Gallery grid, filters, lazy-load, lightbox
│   ├── services.js         Package cards, modal, WhatsApp CTA
│   ├── contact.js          Booking form validation + submit
│   └── admin.js            Dashboard (auth, CRUD, calendar, reminders, todos)
├── schema.sql              Postgres schema + RLS + storage + seed data
├── supabase/
│   ├── config.toml         Supabase CLI project config
│   └── functions/
│       ├── send-email/index.ts        Booking confirmation + studio alert
│       └── process-reminders/index.ts Scheduled reminder emails + notifications
├── .env.example            Server-side secrets for the edge functions
└── .gitignore
```

Every page talks **only** to `window.LumenStore` (in `store.js`). That module
decides at runtime whether to hit Supabase (`window.sb` exists) or the seeded
`localStorage` store. This is what makes demo mode and live mode share one code
path.

---

## Quick start (demo mode)

No credentials, no server, no install:

```bash
# Option A — just open it
open index.html            # macOS  (or double-click the file)

# Option B — serve it (recommended; some browsers restrict file:// features)
cd lumen-studio
python3 -m http.server 8080
# then visit http://localhost:8080
```

**Demo admin login** (from `js/store.js`):

- URL: `admin.html`
- Email: `admin@lumenstudio.example`
- Password: `lumen123`

All demo data lives under the `localStorage` key `lumen_demo_v1`. The admin
dashboard has a **Reset demo data** action that clears it and re-seeds on next
load.

---

## Going live with Supabase

1. **Create a project** at [supabase.com](https://supabase.com).
2. **Run the schema.** Open Supabase Dashboard → SQL Editor, paste the contents
   of `schema.sql`, and Run. This creates all tables, RLS policies, the
   `gallery` storage bucket, and seed rows.
3. **Create your admin user.** Dashboard → Authentication → Users → _Add user_.
   Any authenticated Supabase user is treated as "admin" by the RLS policies.
4. **Add your public credentials to `js/config.js`** by filling in the two
   fields that are blank by default (leave the rest of the object as-is):

   ```js
   // in window.LUMEN_CONFIG
   supabaseUrl: "https://YOUR-PROJECT.supabase.co",
   supabaseAnonKey: "YOUR-ANON-KEY",   // the public anon key ONLY
   ```

   While you're there, also set your real `whatsappNumber` (digits only, incl.
   country code) and brand fields (`businessName`, `email`, `phoneDisplay`,
   `siteUrl`). As soon as `supabaseUrl` and `supabaseAnonKey` are non-empty,
   `supabaseClient.js` creates `window.sb` and the whole site switches to live
   mode automatically. No other code changes needed.

5. **Deploy the edge functions** and schedule reminders — see
   [Edge functions & email](#edge-functions--email) below.

### Optional: Cloudinary for gallery images

If you want to offload gallery uploads to Cloudinary and avoid Supabase storage
limits, add these values in `js/config.js`:

```js
cloudinaryCloudName: "your-cloud-name",
cloudinaryUploadPreset: "lumen-gallery",
```

Then create an unsigned upload preset in Cloudinary named `lumen-gallery` and
leave it as an unsigned preset. The app will upload gallery images to Cloudinary
instead of the Supabase `gallery` bucket, while still saving the image URL in the
site's own database records. This is the easiest free-tier setup for image-heavy
portfolio sites.

> **Never** put the service-role key in `js/config.js` or anywhere the browser
> can read it. The browser uses the anon key only; the service-role key is used
> exclusively by the `process-reminders` edge function.

---

## Database schema

Defined in `schema.sql`. Column shapes match `js/store.js` exactly.

**`gallery_items`** — `id uuid pk`, `title text`, `description text`,
`image_url text`, `tags text[]`, `price numeric`, `created_at timestamptz`.

**`packages`** — `id text pk` (`standard`/`professional`/`premium` slug),
`name text`, `price numeric`, `description text`, `features text[]`, `sort int`.

**`bookings`** — `id uuid pk`, `client_name text`, `client_email text`,
`package_id text fk→packages`, `custom_details text`, `date_time timestamptz`,
`status text` (`pending`/`confirmed`/`completed`/`cancelled`),
`reminder_offset_type text` (`days`/`weeks`/`months`), `reminder_offset_value int`,
`notified_dashboard bool`, `reminder_sent bool` (set by `process-reminders`),
`created_at timestamptz`.

**`todos`** — `id uuid pk`, `title text`, `description text`,
`related_booking_id uuid fk→bookings`, `status text` (`pending`/`completed`),
`due_date date`, `created_at timestamptz`.

**`notifications`** — `id uuid pk`, `type text` (`booking`/`reminder`/`info`),
`message text`, `related_id uuid`, `read bool`, `created_at timestamptz`.

**`settings`** — single row `id='global'`, `reminder_offset_type text`,
`reminder_offset_value int`. Holds the default reminder lead time.

**Row Level Security** (all tables have RLS enabled):

| Table           | anon   | authenticated (admin) |
| --------------- | ------ | --------------------- |
| `gallery_items` | select | all                   |
| `packages`      | select | all                   |
| `bookings`      | insert | select/update/delete  |
| `notifications` | insert | all                   |
| `settings`      | select | all                   |
| `todos`         | —      | all                   |

`anon` can insert a booking + its notification and read packages/settings (the
booking form needs the lead time). Everything else is admin-only. Storage: a
public `gallery` bucket with public read and authenticated write on
`storage.objects`.

---

## Data-access API (`window.LumenStore`)

Every page uses this single module. Each method works identically in demo and
live mode.

```
Auth
  signIn(email, password)      → user            (throws on bad credentials)
  signOut()                    → void
  currentUser()                → user | null
  demoCredential               { email, password }   (demo only)

Gallery
  list()                       → item[]  (newest first)
  create(item, file?)          → item    (uploads file if provided)
  update(id, patch, file?)     → item
  remove(id)                   → void

Packages
  list()                       → package[]  (by sort)
  update(id, patch)            → package

Bookings
  create(booking)              → booking  (+ notification, + email in live mode)
  list()                       → booking[]  (by date_time)
  update(id, patch)            → booking

Todos
  list()                       → todo[]
  create(todo)                 → todo
  update(id, patch)            → todo
  remove(id)                   → void

Notifications
  list()                       → notification[]
  create(notification)         → notification
  markRead(id)                 → void

Settings
  get()                        → settings
  update(patch)                → settings

uploadImage(file)              → publicUrl | dataURL
resetDemo()                    → void  (clears demo localStorage)
```

`Bookings.create()` accepts `{ client_name, client_email, package_id,
custom_details, date_time (ISO string), reminder_offset_type,
reminder_offset_value }`; it forces `status: "pending"`, writes a `booking`
notification, and (live mode) invokes the `send-email` function.

---

## Edge functions & email

Two Deno edge functions live under `supabase/functions/`.

### `send-email`

Invoked by the browser right after a booking:

```js
supabase.functions.invoke("send-email", {
  body: { kind: "booking_confirmation", to, name, date_time },
});
```

It sends a confirmation to the client **and** a heads-up to
`ADMIN_NOTIFY_EMAIL`. It prefers the SendGrid HTTP API when `SENDGRID_API_KEY`
is set; otherwise it falls back to generic SMTP (`SMTP_*`). Failure is
non-fatal to the booking — the booking still succeeds if mail can't be sent.

```bash
supabase functions deploy send-email
supabase secrets set MAIL_FROM="Lumen Studio <hello@yourdomain.com>" \
                     ADMIN_NOTIFY_EMAIL="studio@yourdomain.com" \
                     SENDGRID_API_KEY="SG.xxxx"
# — or, instead of SendGrid —
supabase secrets set SMTP_HOST=... SMTP_PORT=587 SMTP_USER=... SMTP_PASS=...
```

### `process-reminders`

A scheduled function (uses the **service-role** key to bypass RLS). See the
next section.

---

## Reminder system

Each booking stores its own `reminder_offset_type` + `reminder_offset_value`,
copied from `settings` at booking time — so changing the default later does not
retroactively move existing reminders.

`process-reminders` runs on a schedule and, for every booking where
`reminder_sent = false`, status ≠ `cancelled`, and `date_time` is in the future:

1. if `now >= (shoot date − lead time)`, it emails the studio,
2. inserts a `reminder` notification (surfaced as a dashboard pop-up), and
3. sets `reminder_sent = true` so it fires exactly once.

Deploy and schedule it hourly:

```bash
supabase functions deploy process-reminders

# Option A — Dashboard → Edge Functions → process-reminders → add a Cron schedule "0 * * * *"

# Option B — pg_cron
select cron.schedule('lumen-reminders', '0 * * * *', $$
  select net.http_post(
    url:='https://YOUR-PROJECT.supabase.co/functions/v1/process-reminders',
    headers:='{"Authorization":"Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
$$);
```

In demo mode, reminders and confirmation emails are simulated (logged to the
console) since there is no server.

---

## Environment variables

These are **server-side secrets** for the edge functions (set with
`supabase secrets set`), documented in `.env.example`. They are _not_ used by
the browser.

| Variable                               | Used by           | Purpose                                                    |
| -------------------------------------- | ----------------- | ---------------------------------------------------------- |
| `SUPABASE_URL`                         | process-reminders | Project URL (auto-injected in the Supabase runtime)        |
| `SUPABASE_ANON_KEY`                    | —                 | Public key; lives in `js/config.js`, not here              |
| `SUPABASE_SERVICE_ROLE_KEY`            | process-reminders | Bypasses RLS. **Server-side only — never in the browser.** |
| `SENDGRID_API_KEY`                     | both functions    | Preferred email provider                                   |
| `SMTP_HOST` / `PORT` / `USER` / `PASS` | both functions    | SMTP fallback if no SendGrid key                           |
| `MAIL_FROM`                            | both functions    | From header, e.g. `Lumen Studio <hello@domain.com>`        |
| `ADMIN_NOTIFY_EMAIL`                   | both functions    | Where studio alerts/reminders are sent                     |

The public anon key and Supabase URL for the **browser** go in `js/config.js`,
not in `.env`.

---

## Deployment

The public site is static — host the folder anywhere:

- **Netlify / Vercel / Cloudflare Pages / GitHub Pages** — point at the repo
  root; no build command, publish directory is `/`.
- **Any static host / S3 / nginx** — upload the files as-is.

Make sure `js/config.js` contains your live Supabase credentials before
deploying (or leave them blank to ship the demo). Deploy the two edge functions
and schedule `process-reminders` as above.

---

## Costs & free-tier limits

Short version: **demo mode is 100% free forever**, and a live site can run on
free tiers too — the one piece that can eventually cost money is transactional
email at higher volume. Prices below are typical published figures; check each
provider for the current numbers.

### Demo mode — free, no account

Everything runs in the browser off seeded `localStorage`. No server, no
database, no sign-ups. You can host the static folder anywhere (or just open it
locally) and it costs nothing. This is the whole site — every page, the gallery
upload, and the full admin dashboard — just without a shared backend.

### Live mode — Supabase free tier

The free "Free" plan covers everything this project uses:

- **Postgres database** — all six tables, generous for a studio's booking/gallery data.
- **Auth** — up to ~50,000 monthly active users (you need one: yourself).
- **Storage** — for gallery images, on the order of ~1 GB with a monthly egress cap.
- **Edge Functions** — the `send-email` and `process-reminders` Deno functions, with a monthly invocation allowance that an hourly cron stays well under.

Caveats to know:

- **Free projects pause after ~1 week of inactivity.** They resume on the next
  request, but the first hit after a pause is slow, and a paused project won't
  run its scheduled reminder cron. Keeping a project always-on means moving to a
  paid plan (~$25/month at the time of writing).
- **Storage and bandwidth are modest.** Large, un-optimized image libraries can
  bump the limits — compress uploads or use an image CDN if the gallery grows.
- Limits and prices change; the [Supabase pricing page](https://supabase.com/pricing)
  is the source of truth.

### Hosting the static site — free

The public site is just static files, so free static hosts cover it with no
build cost: **Netlify**, **Vercel**, **Cloudflare Pages**, and **GitHub Pages**
all have free tiers that are plenty for this. A custom domain is the only
optional cost, and that's the registrar's fee, not the host's.

### Email — the one piece that isn't unlimited

Confirmation and reminder emails go through SendGrid (or SMTP). Free tiers are
small — SendGrid's free plan is on the order of ~100 emails/day — which is fine
for a studio's booking volume, but not "unlimited." A few things to note:

- Sending from your **own domain** (e.g. `hello@yourstudio.com`) may require
  domain verification and, depending on the provider, a paid plan.
- **Email is optional.** Bookings, notifications, the dashboard, and reminders
  as dashboard pop-ups all work with no email provider configured — you just
  won't get the outbound confirmation/alert emails.

### Bottom line

You can run this entirely free by staying on Supabase's free tier and a free
static host, accepting the inactivity-pause behavior and small email limits. The
realistic paid upgrades, only if you outgrow the free tiers, are: keeping
Supabase always-on (~$25/mo), a higher email tier, and a custom domain.

---

## Test plan

**Demo mode (no setup)**

1. Open `index.html` (or serve on `:8080`). Confirm hero parallax, grain
   overlay, and scroll reveals render.
2. Gallery: filter by a tag, confirm the grid updates; open a tile → lightbox;
   navigate with arrow keys and close with `Esc`.
3. Services: hover a package card (it scales); click it (modal opens with full
   description/features); click **Custom Package** (WhatsApp link opens with a
   pre-filled message).
4. Contact: submit with an empty required field → inline error. Submit valid
   data → success message; a `booking` notification appears in the dashboard.
5. Admin: log in with the demo credential. Add a gallery item with an image →
   it appears on the public gallery. Edit a package price → it shows on
   Services. Change a booking status. Open the calendar view. Set a reminder
   lead time. Add a todo, toggle it completed. Mark a notification read.
6. Click **Reset demo data** → reload → seed data returns.

**Live mode (Supabase)**

1. Run `schema.sql`; verify all six tables + `gallery` bucket exist and seed
   rows are present.
2. Add anon URL/key to `js/config.js`; reload — the site now reads from
   Supabase (network calls to `*.supabase.co`, not localStorage).
3. Create a Supabase Auth user; log into `admin.html` with it.
4. Upload a gallery image → confirm the object lands in the `gallery` bucket
   and the public URL renders.
5. Submit a booking → confirm a row in `bookings`, a `booking` notification, a
   client confirmation email, and a studio alert email.
6. Invoke `process-reminders` (manually or wait for the cron) against a booking
   whose reminder window has opened → confirm a reminder email + a `reminder`
   notification, and `reminder_sent` flips to `true`.
7. RLS check: while logged out, confirm you can read gallery/packages and
   insert a booking, but cannot read `todos` or update `packages`.

**Cross-cutting**

- Responsive: check mobile (~375px), tablet (~768px), and desktop widths.
- Keyboard: tab through nav, forms, gallery, and modals; confirm focus rings
  and that modals/lightbox trap and restore focus.
- `prefers-reduced-motion`: enable it and confirm parallax/animations calm down.
- Lighthouse: run against the home and gallery pages for performance/SEO/a11y.

---

## Accessibility & SEO

- Skip-to-content link, visible `:focus-visible` rings, `aria` labels on
  interactive controls, `sr-only` helper text, and full keyboard support in the
  gallery lightbox and service modals.
- `prefers-reduced-motion` is respected — parallax and reveal animations reduce
  to simple fades.
- Semantic landmarks (`header`/`nav`/`main`/`footer`), descriptive `alt` text,
  and lazy-loaded images (`loading="lazy"`).
- Per-page `<title>`, meta description, canonical URL, Open Graph tags, and a
  JSON-LD `LocalBusiness` block on the home page. `admin.html` is
  `noindex, nofollow`.

---

## Security notes

- The browser only ever uses the **anon** key. All privileged access is gated by
  Row Level Security, so the anon key can only do what the RLS policies allow
  (read public content, insert a booking + notification).
- The **service-role key** is used solely by `process-reminders` on the server
  and must never appear in `js/config.js`, client code, or the repo. Keep it in
  Supabase secrets / your host's environment.
- Admin capability = any authenticated Supabase Auth user. Restrict who can sign
  up (Supabase Auth settings) so only real studio staff get accounts.
- `.env` is git-ignored; only `.env.example` (no real values) is committed.
