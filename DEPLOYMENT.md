# Deployment Guide — DuckSaaS / Maskani

This app is **early-stage** — deploy to a staging/demo environment first,
validate the payment flows with sandbox credentials, then go live.

## What you need

| Requirement | Notes |
|---|---|
| Node 20+ or Docker | Docker Compose is the simplest path |
| PostgreSQL 16 | Bundled in `docker-compose.yml`, or use Neon/Supabase/RDS |
| Redis | Optional today (no code depends on it yet), bundled in compose |
| A domain (optional) | Platform subdomain works for launch |
| `NEXTAUTH_SECRET` | Generate: `openssl rand -base64 32` |
| SMTP credentials | For invoice/welcome/receipt emails (optional — logs skipped without it) |
| Telegram bot | Optional admin notifications |

## Option A — Docker Compose (VPS / own server)

```bash
# 1. Clone and configure
git clone https://github.com/wilndotcom/ducksaas-maskani.git
cd ducksaas-maskani
cp .env.example .env
# Edit .env — at minimum set:
#   POSTGRES_PASSWORD   (strong, unique)
#   NEXTAUTH_SECRET     (openssl rand -base64 32)
#   NEXTAUTH_URL        (your public URL, e.g. https://maskani.example.com)
#   SEED_ADMIN_PASSWORD (strong, 12+ chars)
#   CRON_SECRET         (openssl rand -base64 32)

# 2. Build and start (runs migrations automatically via the `migrate` service)
docker compose up -d --build

# 3. Seed the production baseline (admin, plans, master Maskani org)
docker compose exec app npm run db:seed:prod
# or from your machine against the DB:
#   DATABASE_URL=... SEED_ADMIN_PASSWORD=... npm run db:seed:prod
```

Put a reverse proxy (Caddy/Nginx/Traefik) in front for HTTPS — Caddy is the
easiest (`maskani.example.com { reverse_proxy localhost:3000 }`).

## Option B — Railway / Render (Docker)

Both can build straight from the repo using the `Dockerfile`:

- Add a **PostgreSQL** plugin/service and set `DATABASE_URL`
- Set all env vars from `.env.example`
- The `migrate` compose service won't run — instead run once after deploy:
  `npx prisma migrate deploy` (Railway shell / Render shell)
- Then `npm run db:seed:prod` with `SEED_ADMIN_PASSWORD` set

## Option C — Vercel + Neon (serverless)

Next.js deploys natively, but you lose the bundled Postgres:

1. Create a **Neon** Postgres DB → copy the `DATABASE_URL`
2. Import the repo in Vercel → it auto-detects Next.js
3. Set env vars: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
   (your `*.vercel.app` URL), `SEED_ADMIN_*`, `CRON_SECRET`
4. Run migrations + seed once from your machine:
   ```bash
   DATABASE_URL=<neon-url> npx prisma migrate deploy
   DATABASE_URL=<neon-url> SEED_ADMIN_PASSWORD=<strong> npm run db:seed:prod
   ```
5. **Cron**: Vercel Cron can't send custom headers — instead secure the
   endpoint differently or use an external pinger (cron-job.org, GitHub
   Actions) hitting `GET /api/cron/generate-invoices` daily with
   `Authorization: Bearer $CRON_SECRET`.

## Post-deploy checklist

- [ ] `https://<domain>/auth/admin` — sign in as super admin
- [ ] `/ducksaas/organizations` — grant a trial or assign a plan to a test org
- [ ] `/ducksaas` — configure the **master Maskani org's** payment gateways
      (they are copied to every newly registered org)
- [ ] Register a test landlord at `/auth/register` → verify they land on
      `/maskani/suspended` until you grant a trial (by design)
- [ ] Set up the invoice cron (daily):
      `curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/generate-invoices`
- [ ] Configure SMTP if you want real emails (otherwise they log as skipped)
- [ ] M-Pesa/Paystack: use **sandbox/test keys** first; webhook URLs are
      `https://<domain>/api/webhooks/mpesa` and `/api/webhooks/paystack`
- [ ] Backups: schedule `pg_dump` of Postgres (daily)

## Environment variables

See `.env.example` — the required ones for production are:
`DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `POSTGRES_*` (compose only),
`SEED_ADMIN_EMAIL/USERNAME/PASSWORD` (first seed only), `CRON_SECRET`.
Everything else is optional and degrades gracefully.

## Known limitations (early stage)

- No automated tests yet
- `middleware.ts` uses the deprecated convention (works, migration pending)
- `apiCredentialsEncrypted` stores gateway credentials as JSON — not yet
  encrypted at rest; protect the DB and `.env` accordingly
- `/ducksaas/logs` is a live activity feed, not a persisted audit log —
  there's no record of *who* performed admin actions
- Feature flags on subscription plans are catalog metadata only — not yet
  enforced inside Maskani pages
- No PDF receipts (portal statement is print-friendly HTML)
- Cron must be scheduled externally — nothing generates invoices until
  `/api/cron/generate-invoices` is hit daily
- Tenant subdomains (`slug.example.com`) need wildcard DNS if you use
  `NEXT_PUBLIC_ROOT_DOMAIN`
