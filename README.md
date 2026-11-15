# ducksaas-maskani

A multi-tenant SaaS platform for property management, combining a super-admin console (**DuckSaaS**) with a tenant-facing property management app (**Maskani**).

> **Status: early development.** This project is **not yet production-ready**. Core scaffolding, auth, data model, and billing logic exist, but payment gateway integrations are normalized stubs, there are no database migrations yet, and several production concerns (email, file uploads, tenant portal, hardened deployment) are still pending.

## About

**DuckSaaS** is the platform admin panel where the operator manages organizations (tenants), subscription plans, revenue, and platform logs.

**Maskani** is the product each organization gets — a property management system for landlords and property managers featuring:

- **Properties & Units** — manage buildings, units, and occupancy
- **Tenants** — tenant records, leases, and rent tracking
- **Invoices** — rent invoicing with M-Pesa and Paystack payment webhooks
- **Maintenance** — maintenance request tracking
- **Complaints** — tenant complaint handling
- **Subscription enforcement** — plans, billing, and suspended-account handling
- **Multi-tenancy** — organizations are isolated by domain/subdomain, with per-org settings and payment plans
- **Notifications** — Telegram integration for alerts

## Stack

- **Next.js** (App Router) + TypeScript + Tailwind CSS
- **NextAuth** for authentication
- **Prisma** ORM with PostgreSQL
- **Docker** + `docker-compose` for deployment

## Getting Started

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
