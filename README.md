# DuckSaaS + Maskani

A multi-tenant SaaS platform for property management: a super-admin console (**DuckSaaS**) that runs the platform, and a full property-management product (**Maskani**) that each landlord organization gets.

> **Status: early development — not yet production-ready.** The core flows work end-to-end (leases → invoices → payments → portal), but real payment credentials, email/SMTP, cron scheduling, and a production deployment still need to be configured before going live. See [DEPLOYMENT.md](./DEPLOYMENT.md).

## The three portals

| Portal | Who | What it does |
|---|---|---|
| `/ducksaas` | Platform super-admin | Organizations, subscription plans, revenue, feature modules, system logs, user management, platform settings |
| `/maskani` | Landlords, caretakers, admins | Properties & units, tenants & leases, rent invoicing, payments, maintenance, complaints, water billing, reports, notifications, settings |
| `/portal` | Tenants | Invoices & payments (M-Pesa/Paystack/bank transfer to *their landlord's* accounts), maintenance requests, complaints, statements, water usage, notifications, profile |

Auth is split: `/auth/admin` for DuckSaaS super-admins, `/auth/signin` for everyone else (username or email).

## Feature highlights

- **Leases drive everything** — `Property → Unit → Lease → Tenant → Invoices → Payments`. Active leases mark units occupied, create tenant portal accounts, and drive recurring billing.
- **Per-unit pricing** — each unit has its own type (bedsitter/1br/2br…), rent, deposit, water rate, and recurring extra charges (internet, parking, retainers…).
- **Billing cron** — `/api/cron/generate-invoices` generates invoices per lease billing day, with **missed-month catch-up** (backfills up to 12 months), mid-month **proration**, per-lease **water charges**, recurring unit charges, configurable **late fees**, and overdue marking + reminders.
- **Per-tenant water billing** — meter readings are stamped to a lease, so a new tenant never inherits the previous tenant's consumption.
- **Deposit lifecycle** — deposit invoice at move-in, difference-only billing on transfers, collect/refund/forfeit tracking.
- **Landlord-owned payment collection** — each org configures its own M-Pesa Paybill/Till, Paystack, or bank account; tenants pay directly into the landlord's accounts. Platform M-Pesa/Paystack env credentials are only for SaaS subscription billing.
- **In-app notifications** for both landlords and tenants (invoices, payments, tickets, complaints, overdue).
- **Maintenance ↔ unit status** — high-priority/structural tickets flag units `maintenance`; resolving the last ticket restores occupancy.
- **Tenant transfers** between units/properties with atomic lease swap and preserved history.
- **Dashboard analytics** — KPI cards, collections chart, occupancy donut, invoice health, arrears attention strip.
- **Reports** — collection summary, arrears aging, 6-month trend, rent roll by property.
- **Appearance** — Light / Dark / System / **Auto** (OS-aware + night hours) with instant switching.
- **Subscription enforcement** — trials, plans, grace periods, suspension.

## Stack

- **Next.js 16** (App Router, Cache Components) + React 19 + TypeScript + Tailwind CSS 4
- **NextAuth** (credentials) · **Prisma 5** + PostgreSQL · **Recharts**
- M-Pesa Daraja (STK/C2B), Paystack, SMTP email, Telegram alerts
- Docker + docker-compose for self-hosting

## Getting started

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL, NEXTAUTH_SECRET, etc.
npm run db:push             # sync schema to your dev database
npm run db:seed             # dev seed (WIPES the database — dev only!)
npm run dev                 # http://localhost:3000
```

### Demo accounts (after `db:seed`)

| Login | Password | Portal |
|---|---|---|
| `admin` / seed admin email | `SEED_ADMIN_PASSWORD` env | `/auth/admin` → `/ducksaas` |
| `landlord1` | `password123` | `/maskani` (Kamau Properties) |
| `landlord2` | `password123` | `/maskani` (Ochieng Estates) |
| `tenant2` / `tenant3` | `tenant123` | `/portal` |

### Scripts

```bash
npm run dev          # dev server
npm run build        # production build
npm run lint         # eslint
npm run db:generate  # prisma client
npm run db:push      # push schema (dev)
npm run db:migrate   # create/apply migrations
npm run db:seed      # dev seed — DESTRUCTIVE, requires SEED_CONFIRM=1
npm run db:seed:prod # production seed — safe, idempotent (admin + plans + master org)
```

## Cron

Invoice generation needs a daily hit to `/api/cron/generate-invoices` with `Authorization: Bearer $CRON_SECRET`. See [DEPLOYMENT.md](./DEPLOYMENT.md) for scheduling options.

## Project layout

```
src/app/ducksaas/    platform admin console
src/app/maskani/     landlord workspace
src/app/portal/      tenant portal
src/app/api/         auth, cron, payment webhooks
src/lib/             auth, payments, email, telegram, notifications, org-settings
prisma/              schema, migrations, seeds
```

## Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** — Docker Compose VPS, Railway/Render, and Vercel+Neon paths, env var reference, and post-deploy checklist.
