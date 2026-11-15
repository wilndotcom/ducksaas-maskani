'use client'

import { useMemo, useState, useTransition, type ComponentType } from 'react'
import {
  Building2,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Users,
  Home,
  FileText,
  Wrench,
  Calendar,
  Shield,
  CheckCircle2,
  AlertTriangle,
  PauseCircle,
  UserPlus,
  UserCheck,
  Mail,
  Phone,
  Lock,
} from 'lucide-react'
import { createOrganization, updateOrganization, deleteOrganization } from './actions'

type Org = {
  id: string
  name: string
  slug: string
  status: string
  ownerUserId: string
  ownerName: string
  ownerEmail: string
  subscriptionPlanId: string | null
  planName: string | null
  planPricingModel?: string | null
  subscriptionEndsAt: string
  createdAt: string
  counts: { members: number; properties: number; units: number; leases: number; invoices: number; maintenanceTickets: number }
}
type Plan = {
  id: string
  name: string
  isActive: boolean
  pricingModel?: string
  priceMonthly?: number
  priceYearly?: number
  pricePerPropertyMonthly?: number
  pricePerPropertyYearly?: number
  includedProperties?: number
  currency?: string
}
type User = { id: string; name: string; email: string; globalRole: string }

const statusMeta: Record<string, { label: string; cls: string; icon: ComponentType<{ className?: string }> }> = {
  active: { label: 'Active', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', icon: CheckCircle2 },
  grace_period: { label: 'Grace period', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300', icon: AlertTriangle },
  suspended_readonly: { label: 'Suspended', cls: 'bg-rose-500/15 text-rose-700 dark:text-rose-300', icon: PauseCircle },
}

function StatusBadge({ status }: { status: string }) {
  const m = statusMeta[status] || { label: status, cls: 'bg-slate-500/15 text-slate-700 dark:text-slate-300', icon: Shield }
  const Icon = m.icon
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${m.cls}`}>
      <Icon className="h-3.5 w-3.5" /> {m.label}
    </span>
  )
}

export function OrganizationsManager({ organizations, plans, users, rootDomain }: { organizations: Org[]; plans: Plan[]; users: User[]; rootDomain: string }) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Org | null>(null)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formSlug, setFormSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [ownerMode, setOwnerMode] = useState<'existing' | 'new'>('existing')
  const [ownerName, setOwnerName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerPhone, setOwnerPhone] = useState('')
  const [ownerPassword, setOwnerPassword] = useState('')

  const slugify = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return organizations.filter((o) => {
      const matchQ = !q || [o.name, o.slug, o.ownerName, o.ownerEmail, o.planName || ''].some((v) => v.toLowerCase().includes(q))
      const matchS = statusFilter === 'all' || o.status === statusFilter
      return matchQ && matchS
    })
  }, [organizations, query, statusFilter])

  const stats = useMemo(() => {
    const total = organizations.length
    const active = organizations.filter((o) => o.status === 'active').length
    const grace = organizations.filter((o) => o.status === 'grace_period').length
    const suspended = organizations.filter((o) => o.status === 'suspended_readonly').length
    return { total, active, grace, suspended }
  }, [organizations])

  const owners = useMemo(() => users.filter((u) => u.globalRole === 'standard' || u.globalRole === 'super_admin'), [users])

  const flash = (m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(null), 2500)
  }

  const openCreate = () => {
    setEditing(null)
    setFormName('')
    setFormSlug('')
    setSlugEdited(false)
    setOwnerMode('existing')
    setOwnerName('')
    setOwnerEmail('')
    setOwnerPhone('')
    setOwnerPassword('')
    setShowForm(true)
  }
  const openEdit = (o: Org) => {
    setEditing(o)
    setFormName(o.name)
    setFormSlug(o.slug)
    setSlugEdited(true)
    setOwnerMode('existing')
    setOwnerName('')
    setOwnerEmail('')
    setOwnerPhone('')
    setOwnerPassword('')
    setShowForm(true)
  }
  const closeForm = () => { setEditing(null); setShowForm(false) }

  const onNameChange = (value: string) => {
    setFormName(value)
    if (!editing && !slugEdited) {
      setFormSlug(slugify(value))
    }
  }

  const onSlugChange = (value: string) => {
    setSlugEdited(true)
    setFormSlug(slugify(value))
  }

  const onSubmit = async (formData: FormData) => {
    startTransition(async () => {
      try {
        if (editing) await updateOrganization(formData)
        else await createOrganization(formData)
        flash(editing ? 'Organization updated' : 'Organization created')
        closeForm()
      } catch (e) {
        flash(e instanceof Error ? e.message : 'Failed to save organization')
      }
    })
  }

  const onDelete = (id: string, name: string) => {
    if (!confirm(`Delete organization "${name}"? This will remove related data.`)) return
    startTransition(async () => {
      try {
        const fd = new FormData()
        fd.set('id', id)
        await deleteOrganization(fd)
        flash('Organization deleted')
      } catch (e) {
        flash(e instanceof Error ? e.message : 'Failed to delete organization')
      }
    })
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg"><Building2 className="h-5 w-5" /></span>
            Organizations
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">Manage landlord organizations, owners, plans, and subscription status.</p>
        </div>
        <div className="flex items-center gap-3">
          {msg && <div className="rounded-xl bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">{msg}</div>}
          <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/20 transition hover:opacity-95">
            <Plus className="h-4 w-4" /> Add Organization
          </button>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total Organizations</p>
          <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-5 shadow-sm backdrop-blur-xl dark:border-emerald-500/20 dark:bg-emerald-500/10">
          <p className="text-sm text-emerald-700 dark:text-emerald-300">Active</p>
          <p className="mt-1 text-3xl font-bold text-emerald-700 dark:text-emerald-200">{stats.active}</p>
        </div>
        <div className="rounded-2xl border border-amber-200/70 bg-amber-50/70 p-5 shadow-sm backdrop-blur-xl dark:border-amber-500/20 dark:bg-amber-500/10">
          <p className="text-sm text-amber-700 dark:text-amber-300">Grace Period</p>
          <p className="mt-1 text-3xl font-bold text-amber-700 dark:text-amber-200">{stats.grace}</p>
        </div>
        <div className="rounded-2xl border border-rose-200/70 bg-rose-50/70 p-5 shadow-sm backdrop-blur-xl dark:border-rose-500/20 dark:bg-rose-500/10">
          <p className="text-sm text-rose-700 dark:text-rose-300">Suspended</p>
          <p className="mt-1 text-3xl font-bold text-rose-700 dark:text-rose-200">{stats.suspended}</p>
        </div>
      </div>

      {showForm && (
        <div className="mb-8 rounded-2xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{editing ? 'Edit Organization' : 'Create Organization'}</h2>
            <button onClick={closeForm} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
          </div>
          <form action={onSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Name *</label>
              <input name="name" required value={formName} onChange={(e) => onNameChange(e.target.value)} placeholder="e.g. Acme Properties" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/20 dark:border-white/10 dark:bg-slate-900/60 dark:text-white" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Subdomain / Slug *</label>
              <input name="slug" required value={formSlug} onChange={(e) => onSlugChange(e.target.value)} placeholder="auto from name" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/20 dark:border-white/10 dark:bg-slate-900/60 dark:text-white" />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Subdomain:{' '}
                <a
                  href="/maskani"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-cyan-700 hover:underline dark:text-cyan-300"
                  title="Open organization workspace (sign in as org owner)"
                >
                  {formSlug || 'your-org'}.{rootDomain}
                </a>
              </p>
            </div>
            <div className="sm:col-span-2 lg:col-span-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-slate-900/30">
              <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Organization Owner</p>
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setOwnerMode('existing')}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    ownerMode === 'existing'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'
                  }`}
                >
                  <UserCheck className="h-4 w-4" /> Select existing owner
                </button>
                <button
                  type="button"
                  onClick={() => setOwnerMode('new')}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    ownerMode === 'new'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'
                  }`}
                >
                  <UserPlus className="h-4 w-4" /> Create new owner
                </button>
              </div>
              <input type="hidden" name="ownerMode" value={ownerMode} />

              {ownerMode === 'existing' ? (
                <div className="max-w-xl">
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Owner account *</label>
                  <select name="ownerUserId" required defaultValue={editing?.ownerUserId || ''} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/20 dark:border-white/10 dark:bg-slate-900/60 dark:text-white">
                    <option value="">Select an existing user</option>
                    {owners.map((u) => <option key={u.id} value={u.id}>{u.name} — {u.email}</option>)}
                  </select>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Choose an existing platform user to own this organization.</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Full name *</label>
                    <div className="relative">
                      <UserPlus className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input name="ownerName" required value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Owner full name" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/20 dark:border-white/10 dark:bg-slate-900/60 dark:text-white" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Email *</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input type="email" name="ownerEmail" required value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="owner@example.com" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/20 dark:border-white/10 dark:bg-slate-900/60 dark:text-white" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Phone</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input name="ownerPhone" value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} placeholder="+254..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/20 dark:border-white/10 dark:bg-slate-900/60 dark:text-white" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Temporary password *</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input type="password" name="ownerPassword" required minLength={8} value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} placeholder="Min. 8 characters" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/20 dark:border-white/10 dark:bg-slate-900/60 dark:text-white" />
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Creates a new landlord account and assigns it as owner/admin.</p>
                  </div>
                </div>
              )}
            </div>
            {editing && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Status</label>
                  <select name="status" defaultValue={editing.status} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/20 dark:border-white/10 dark:bg-slate-900/60 dark:text-white">
                    <option value="active">Active</option>
                    <option value="grace_period">Grace period</option>
                    <option value="suspended_readonly">Suspended (read-only)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">SaaS Subscription Plan</label>
                  <select name="subscriptionPlanId" defaultValue={editing.subscriptionPlanId || ''} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/20 dark:border-white/10 dark:bg-slate-900/60 dark:text-white">
                    <option value="">No plan</option>
                    {plans.map((p) => <option key={p.id} value={p.id}>{p.name} {p.pricingModel === 'per_property' ? '(per property)' : '(fixed)'}{p.isActive ? '' : ' — inactive'}</option>)}
                  </select>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">DuckSaaS billing only. Changing plan auto-calculates charge from current property count.</p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Billing cycle (for charge)</label>
                  <select name="billingCycle" defaultValue="monthly" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/20 dark:border-white/10 dark:bg-slate-900/60 dark:text-white">
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Subscription Ends</label>
                  <input type="date" name="subscriptionEndsAt" defaultValue={editing.subscriptionEndsAt} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/20 dark:border-white/10 dark:bg-slate-900/60 dark:text-white" />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Leave blank to auto-set from billing cycle when recording/assigning a plan.</p>
                </div>
                <div className="sm:col-span-2 lg:col-span-3 rounded-xl border border-slate-200/70 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-slate-900/30">
                  <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">SaaS Charge / Ledger</p>
                  <label className="mb-3 inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" name="recordCharge" defaultChecked className="h-4 w-4 rounded border-slate-300" />
                    Record computed charge in subscription ledger (auto when plan changes)
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Payment gateway</label>
                      <input name="paymentGateway" defaultValue="manual_admin" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none dark:border-white/10 dark:bg-slate-900/60 dark:text-white" placeholder="manual_admin / mpesa / paystack" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Transaction reference</label>
                      <input name="transactionRef" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none dark:border-white/10 dark:bg-slate-900/60 dark:text-white" placeholder="Optional (auto-generated if blank)" />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Per-property plans are charged as base + extra properties (properties above included). Amount is calculated from org property count and stored in revenue ledger.</p>
                </div>
              </>
            )}
            <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-3 pt-2">
              <button type="button" onClick={closeForm} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5">Cancel</button>
              <button type="submit" disabled={pending} className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900">{pending ? 'Saving...' : editing ? 'Update Organization' : 'Create Organization'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, slug, owner, plan..." className="w-full rounded-xl border border-slate-200 bg-white/70 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2.5 text-sm outline-none dark:border-white/10 dark:bg-white/5 dark:text-white">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="grace_period">Grace period</option>
          <option value="suspended_readonly">Suspended</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200/80 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500 dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Organization</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Subscription Ends</th>
                <th className="px-4 py-3">Usage</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-white/5">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">No organizations found.</td></tr>
              ) : filtered.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50/60 dark:hover:bg-white/5">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900 dark:text-white">{o.name}</p>
                    <a href={`/maskani?org=${o.id}`} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-700 hover:underline dark:text-cyan-300" title="Open organization workspace">
                      {o.slug}.{rootDomain}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-800 dark:text-slate-100">{o.ownerName || '—'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{o.ownerEmail}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                    {o.planName ? (
                      <div>
                        <p>{o.planName}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{o.planPricingModel === 'per_property' ? 'Per property' : 'Fixed price'} · {o.counts.properties} properties</p>
                      </div>
                    ) : <span className="text-slate-400">No plan</span>}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                    <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-slate-400" />{o.subscriptionEndsAt || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1" title="Members"><Users className="h-3.5 w-3.5" />{o.counts.members}</span>
                      <span className="inline-flex items-center gap-1" title="Properties"><Building2 className="h-3.5 w-3.5" />{o.counts.properties}</span>
                      <span className="inline-flex items-center gap-1" title="Units"><Home className="h-3.5 w-3.5" />{o.counts.units}</span>
                      <span className="inline-flex items-center gap-1" title="Leases"><FileText className="h-3.5 w-3.5" />{o.counts.leases}</span>
                      <span className="inline-flex items-center gap-1" title="Invoices"><FileText className="h-3.5 w-3.5" />{o.counts.invoices}</span>
                      <span className="inline-flex items-center gap-1" title="Maintenance"><Wrench className="h-3.5 w-3.5" />{o.counts.maintenanceTickets}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{o.createdAt}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEdit(o)} title="Edit" className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => onDelete(o.id, o.name)} disabled={pending} title="Delete" className="rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
