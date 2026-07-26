# The Venue — Hotel & Restaurant Platform + Staff ERP

A hotel website with a real booking engine, an in-house restaurant with online
ordering, online payments through **Razorpay** and **ICICI Bank Eazypay**, an
admin panel that owns every word, price and photograph on the public site —
and a full **staff ERP / property-management system** at `/erp` (Staff Login
in the site header and footer).

Built with Next.js (App Router), Prisma + SQLite, Tailwind and shadcn/ui.
It runs from a single container with no external database — website and ERP
share one deployment and one backup.

> **Every name, price and photo shipped here is a placeholder.** Nothing is
> hard-coded in a component — change it all from **Admin → Settings / Website
> Copy / Menu**, with no code edits and no redeploy.

---

## Getting started

```bash
npm install
cp .env.example .env          # then set ADMIN_PASSWORD at minimum
npx prisma generate --schema=prisma/schema.prisma
npx prisma db push --schema=prisma/schema.prisma
npm run dev
```

Open http://localhost:3000 — the first page load seeds placeholder rooms, a
menu and all default settings. The admin panel is at **/admin**.

### Docker / Synology

```bash
ADMIN_PASSWORD='choose-something-strong' docker compose up -d --build
```

The site listens on port **3005**. The database and all uploaded images share
the `venue-hotel-data` volume, so one backup captures the whole site.

---

## What is where

| Area | Path |
| --- | --- |
| Public site | `src/components/hotel/` |
| Restaurant ordering | `src/components/restaurant/` |
| Admin panel | `src/components/admin/` |
| **Staff ERP (UI)** | `src/components/erp/`, `src/app/erp/` |
| **Staff ERP (API)** | `src/app/api/erp/` |
| **ERP domain logic** | `src/lib/erp/` (auth, RBAC, GST, folio, payroll, night audit) |
| API routes | `src/app/api/` |
| Editable-content schema | `src/lib/settings-schema.ts` |
| Pricing (shared client/server) | `src/lib/pricing.ts`, `src/lib/menu.ts` |
| Payment gateways | `src/lib/payments/` |

---

## Staff ERP (`/erp`)

A role-based property-management system for the whole hotel, built for Indian
operations. First visit shows a one-time setup screen: enter the website
`ADMIN_PASSWORD` to create the first ERP administrator, then add staff users
with roles (Front Office, Housekeeping, F&B, Stores, Accounts, HR,
Engineering, Manager).

**Front office** — live tape chart (physical rooms × dates), walk-ins,
check-in with the legal guest register (Aadhaar/PAN/Passport ID capture,
Form C passport/visa details for foreign nationals), room moves, folios with
GST-correct postings, settlements in cash/UPI/card/bank, printable
registration cards, and a **night audit** that posts room charges and rolls
the business date (IST).

**Billing & GST** — tariff-slab GST for rooms (≤ ₹7,500 → 5%, above → 18%,
editable), CGST/SGST split, SAC codes per line, financial-year invoice
numbering (`INV/25-26/00042`), amount-in-words in lakh/crore, round-off,
printable A4 tax invoices, invoice cancellation with reason, and CSV exports:
GSTR-1 outward register, invoice register, expense register, police guest
register (Form F style) and the Form C list for FRRO filing.

**Housekeeping** — room status board (clean/dirty/inspected/OOO), task queue
with assignment and verification, lost & found register. Checkout dirties the
room and queues a departure clean automatically.

**Restaurant POS** — live kitchen board on the same order engine as the
website, staff order entry, settle by cash/UPI/card or **post to room** so the
bill lands on the guest folio.

**Stores & purchase** — items with HSN/GST, moving-average costing, suppliers
with GSTIN, purchase orders → GRN receiving, departmental issues, physical
count adjustments, reorder alerts and a full stock ledger.

**HR & payroll (India)** — employee records with PAN/Aadhaar/UAN/ESI/bank,
one-tap attendance (unmarked = present; mark the exceptions), leave requests
and balances, salary advances, and monthly payroll: LOP proration, overtime,
EPF 12 % (capped basic), ESI 0.75 %/3.25 % under the wage ceiling,
professional-tax slabs (state-configurable), TDS, advance recovery, printable
payslips, and the salary bill auto-posted to expenses on finalize.

**Banquets & events** — halls, wedding/conference bookings with per-plate
pricing, date-clash warnings, advances, and GST invoices.

**Also**: maintenance tickets + asset/AMC register with expiry alerts, guest
CRM with stay history/VIP/blacklist, occupancy-ADR-RevPAR reports and revenue
charts, an append-only audit trail, and per-user module permissions.

ERP settings (GSTIN, FSSAI, GST slabs, PT slabs, check-in/out times) live in
**ERP → Settings**. Set `ERP_SESSION_SECRET` in production so staff sessions
survive restarts.

---

## Editing content

`src/lib/settings-schema.ts` is the single source of truth for everything a
hotelier can change: brand, contact details, policies, hero slides, the story
band, amenities, testimonials, SEO metadata, currency, taxes and gateway
credentials.

The admin panel renders its editors directly off that schema and the seeder
writes its defaults, so **adding a new editable field is a one-line change**
in that file — it then appears in the panel automatically on the next boot.

---

## Booking engine

- **Live availability.** Each room has a `quantity` (how many identical units
  exist). Overlapping reservations are counted per room; a same-day
  checkout/check-in pair is not treated as a clash.
- **Server-authoritative pricing.** Rates, taxes and fees are always
  recomputed from the database. Prices sent by the browser are ignored, and
  the quote a guest sees comes from the same `computePrice()` the API uses.
- **Guest self-service.** Reservations are looked up with a booking reference
  plus the email used to book; the full list is admin-only.

## Restaurant

Touch-first ordering sized for tablets and phones: a horizontally scrolling
category rail, tiles two-across on a phone and up to four on a tablet, sizes
and add-ons as large tap targets, and a sticky order bar.

Dine-in, room service, takeaway and delivery can each be switched on or off,
with their own fees. Room-service orders can carry a booking reference so the
bill is tied to the guest's stay. The kitchen board (**Admin → Food Orders**)
advances an order through placed → accepted → preparing → ready → served, and
refreshes itself during service.

Like the hotel side, the cart is priced on the server — sizes, add-ons and
availability are all re-resolved from the menu when the order is placed.

---

## Payments

Configure in **Admin → Payments** (or via environment variables, which take
precedence and appear locked in the panel).

### Razorpay

1. Copy the Key ID and Key Secret from the Razorpay dashboard.
2. Paste them in, enable Razorpay and save.
3. Add a webhook for `payment.captured` and `payment.failed` pointing at
   `https://your-domain/api/payments/razorpay/webhook`, and paste its secret in.
4. Take one payment in `test` mode before switching Mode to `live`.

Checkout opens in an overlay; the returned signature is verified server-side
against the account secret. The webhook is the safety net for a guest who
closes the tab before the browser can confirm.

### ICICI Bank (Eazypay)

1. Enter the Merchant ID, Sub-Merchant ID and the 16-character encryption key
   issued by the bank.
2. Register `https://your-domain/api/payments/icici/callback` as the return URL.

Parameters are encrypted with AES-128-ECB as Eazypay requires; response code
`E000` means success, and the amount the bank reports is checked against the
stored total before anything is marked paid.

### Offline

Pay-at-hotel, pay-at-counter and bank transfer are available without any
gateway, and cash taken at the desk can be recorded against a booking or an
order from the admin panel.

**Applying a payment is idempotent** — the browser hand-back, the webhook and
a manual entry can all report the same payment and the balance moves once.

---

## Security notes

- The admin panel is behind a password (`ADMIN_PASSWORD`) with signed,
  HTTP-only session cookies. Set `SECURE_COOKIES=true` when serving over HTTPS.
- Reservations, food orders, uploads, the media library and all mutating
  endpoints require that session. Guest contact details are never public.
- Gateway secrets never leave the server: the public settings endpoint omits
  them and the admin view masks them, so saving the form without retyping a
  secret leaves it intact.
- Uploads are restricted to images, size-capped, re-encoded, and served from a
  route that rejects any path outside the upload directory.

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production (standalone) build |
| `npm run start` | Run the standalone build |
| `npm run lint` | ESLint |
| `npm run db:push` | Apply the Prisma schema |
