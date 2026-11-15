import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Building2, Home as HomeIcon, Sparkles, Shield, BarChart3, Users, ArrowRight, Zap } from 'lucide-react'
import Link from 'next/link'

export const instant = false

export default async function Home() {
  const session = await getServerSession(authOptions)

  if (session) {
    if (session.user.globalRole === 'super_admin') {
      redirect('/ducksaas')
    } else {
      redirect('/maskani')
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-fuchsia-600/30 blur-3xl" />
        <div className="absolute top-1/4 -right-24 h-[30rem] w-[30rem] rounded-full bg-cyan-500/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[26rem] w-[26rem] rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_45%)]" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 via-violet-500 to-cyan-500 shadow-lg shadow-fuchsia-500/30">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight">DuckSaaS <span className="text-cyan-300">&</span> Maskani</p>
            <p className="text-xs text-slate-400">Multi-tenant property platform</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth/register" className="hidden rounded-xl px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/5 sm:inline-flex">Create organization</Link>
          <Link href="/auth/signin" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-white/10 hover:bg-slate-100">
            Sign in <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-6 pb-16 pt-8 lg:px-8 lg:pt-14">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-fuchsia-200">
            <Zap className="h-3.5 w-3.5" /> Modern SaaS + Master Property Workspace
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Run your platform and properties on a{' '}
            <span className="bg-gradient-to-r from-fuchsia-400 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">colorful, professional</span>{' '}
            control center
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-slate-300 sm:text-lg">
            DuckSaaS powers platform administration, billing, and organizations. Maskani gives every landlord a clean, isolated workspace to manage properties, tenants, rent, and maintenance.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/auth/register" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-xl shadow-fuchsia-500/25 hover:opacity-95">
              Start your organization <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/auth/signin" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur hover:bg-white/10">
              Sign in
            </Link>
          </div>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-fuchsia-600/20 via-violet-600/10 to-slate-900/60 p-8 shadow-2xl backdrop-blur-xl">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-fuchsia-500/30 blur-2xl transition group-hover:bg-fuchsia-500/40" />
            <div className="relative">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-violet-600 shadow-lg shadow-fuchsia-500/30">
                <Building2 className="h-7 w-7" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wide text-fuchsia-200">SaaS Control Plane</p>
              <h2 className="mt-2 text-2xl font-bold">DuckSaaS Admin</h2>
              <p className="mt-2 text-slate-300">Manage organizations, subscription plans, revenue, features, and platform settings from one vibrant command center.</p>
              <ul className="mt-5 space-y-2 text-sm text-slate-200">
                <li className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-cyan-300" /> Income widgets: today, weekly, monthly, yearly</li>
                <li className="flex items-center gap-2"><Users className="h-4 w-4 text-violet-300" /> Organization provisioning &amp; ownership</li>
                <li className="flex items-center gap-2"><Shield className="h-4 w-4 text-fuchsia-300" /> Settings, themes, and platform controls</li>
              </ul>
              <Link href="/auth/signin" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-white/15">
                Open Admin Portal <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-600/20 via-teal-600/10 to-slate-900/60 p-8 shadow-2xl backdrop-blur-xl">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-500/30 blur-2xl transition group-hover:bg-emerald-500/40" />
            <div className="relative">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-600 shadow-lg shadow-emerald-500/30">
                <HomeIcon className="h-7 w-7" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">Master Property Portal</p>
              <h2 className="mt-2 text-2xl font-bold">Maskani Workspace</h2>
              <p className="mt-2 text-slate-300">Each organization gets a clean, isolated Maskani account from the master template to manage properties, tenants, rent, and maintenance.</p>
              <ul className="mt-5 space-y-2 text-sm text-slate-200">
                <li className="flex items-center gap-2"><HomeIcon className="h-4 w-4 text-emerald-300" /> Properties, units, leases &amp; tenants</li>
                <li className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-cyan-300" /> Rent, invoices &amp; maintenance tracking</li>
                <li className="flex items-center gap-2"><Shield className="h-4 w-4 text-teal-300" /> Tenant-isolated, secure by design</li>
              </ul>
              <Link href="/auth/signin" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-white/15">
                Open Maskani Portal <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            { t: 'Secure & isolated', d: 'Org-scoped data with role-based access', c: 'from-violet-500/20 to-fuchsia-500/10' },
            { t: 'Ready to scale', d: 'Plans, billing, and multi-tenant onboarding', c: 'from-cyan-500/20 to-blue-500/10' },
            { t: 'Clean new workspaces', d: 'Fresh Maskani copy per organization', c: 'from-emerald-500/20 to-teal-500/10' },
          ].map((f) => (
            <div key={f.t} className={`rounded-2xl border border-white/10 bg-gradient-to-br ${f.c} p-5 backdrop-blur`}>
              <p className="font-semibold text-white">{f.t}</p>
              <p className="mt-1 text-sm text-slate-300">{f.d}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
