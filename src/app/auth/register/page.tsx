'use client'

import { useActionState, useState } from 'react'
import { registerOrganization, type RegisterState } from './actions'
import Link from 'next/link'
import { Building2, User, Mail, Phone, Lock, Globe, Sparkles, ArrowRight } from 'lucide-react'

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
}

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState<RegisterState, FormData>(registerOrganization, {})
  const [orgName, setOrgName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [rootDomain] = useState(() => (typeof window !== 'undefined' ? window.location.host : 'localhost:3000') || 'localhost:3000')

  const onOrgName = (v: string) => {
    setOrgName(v)
    if (!slugEdited) setSlug(slugify(v))
  }
  const onSlug = (v: string) => {
    setSlugEdited(true)
    setSlug(slugify(v))
  }

  const inputCls = 'w-full rounded-xl border border-white/10 bg-slate-900/50 px-4 py-3 text-white placeholder-slate-400 outline-none transition focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/30'

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-fuchsia-600/30 blur-3xl" />
        <div className="absolute top-1/4 -right-24 h-[28rem] w-[28rem] rounded-full bg-cyan-500/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-6 py-10 lg:py-14">
        <div className="mb-8 text-center">
          <Link href="/" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white">
            <Sparkles className="h-4 w-4 text-fuchsia-400" /> DuckSaaS &amp; Maskani
          </Link>
          <h1 className="text-3xl font-extrabold sm:text-4xl">
            Create your <span className="bg-gradient-to-r from-fuchsia-400 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">organization</span>
          </h1>
          <p className="mt-2 text-slate-300">Get a clean, isolated Maskani workspace provisioned from the master template</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          {state?.error && (
            <div className="mb-6 rounded-xl border border-rose-400/30 bg-rose-500/15 p-4">
              <p className="text-sm text-rose-200">{state.error}</p>
            </div>
          )}

          <form action={formAction} className="space-y-8">
            <div>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white"><User className="h-5 w-5 text-fuchsia-300" /> Account owner</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-200">Full name *</label>
                  <input name="ownerName" required className={inputCls} placeholder="Jane Doe" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-200">Email *</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input type="email" name="email" required className={`${inputCls} pl-10`} placeholder="you@example.com" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-200">Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input name="phone" className={`${inputCls} pl-10`} placeholder="+254..." />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-200">Password *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input type="password" name="password" required minLength={8} className={`${inputCls} pl-10`} placeholder="Min. 8 characters" />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 pt-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white"><Building2 className="h-5 w-5 text-cyan-300" /> Organization</h2>
              <div className="grid gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-200">Organization name *</label>
                  <input name="orgName" required value={orgName} onChange={(e) => onOrgName(e.target.value)} className={inputCls} placeholder="e.g. Acme Properties" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-200">Subdomain / workspace URL *</label>
                  <div className="flex overflow-hidden rounded-xl border border-white/10 bg-slate-900/50 focus-within:border-fuchsia-400 focus-within:ring-2 focus-within:ring-fuchsia-500/30">
                    <span className="inline-flex items-center border-r border-white/10 bg-white/5 px-3 text-slate-400"><Globe className="h-4 w-4" /></span>
                    <input name="slug" required value={slug} onChange={(e) => onSlug(e.target.value)} className="flex-1 bg-transparent px-3 py-3 text-white placeholder-slate-400 outline-none" placeholder="acme-properties" />
                    <span className="inline-flex items-center border-l border-white/10 bg-white/5 px-3 text-sm text-slate-400">.{rootDomain}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">Auto-generated from name and based on your current domain.</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-4 text-sm text-cyan-100">
              <p>Your organization is created with a clean Maskani workspace (master template copy) and no subscription plan assigned yet. An admin can add a plan later.</p>
            </div>

            <button type="submit" disabled={pending} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-cyan-600 px-6 py-3 font-semibold text-white shadow-lg shadow-fuchsia-500/25 transition hover:opacity-95 disabled:opacity-50">
              {pending ? 'Creating organization...' : 'Create organization'} <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-300">
            Already have an account? <Link href="/auth/signin" className="font-medium text-cyan-300 hover:text-cyan-200">Sign in</Link>
          </p>
        </div>
        <p className="mt-6 text-center"><Link href="/" className="text-sm text-slate-400 hover:text-white">← Back to home</Link></p>
      </div>
    </div>
  )
}
