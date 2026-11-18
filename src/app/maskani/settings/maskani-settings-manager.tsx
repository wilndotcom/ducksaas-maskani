'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  Sparkles, ArrowLeft, Settings, Building2, Users, CreditCard, Wallet, Bell,
  Palette, Wrench, ChevronRight, Save, CheckCircle2, Moon, Sun, Monitor, SunMoon,
  CalendarClock, AlertTriangle, BadgeDollarSign, Gauge, Workflow, UserCog,
  ReceiptText, MessageSquareWarning, ExternalLink, Zap, Shield, UserPlus, Trash2
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { addOrganizationAdmin, updateOrganizationAdmin, removeOrganizationAdmin, updateOrganizationSettings, upsertPaymentGateway, setPaymentGatewayActive, deletePaymentGateway } from './actions'
import { ADMIN_RIGHT_KEYS, DEFAULT_ADMIN_RIGHTS, RIGHT_LABELS, type AdminRightKey } from './rights'
import { MobileNav } from '@/components/mobile-nav'

type Org = {
  id: string; name: string; slug: string; status: string; ownerUserId: string
  subscriptionEndsAt: string | null
  owner: { name: string; email: string }
  subscriptionPlan: { name: string; currency: string; priceMonthly: number; priceYearly: number; maxUnits: number; isActive: boolean } | null
}
type Stats = { properties: number; units: number; members: number; leases: number; invoices: number; maintenanceTickets: number }
type Gateway = { id: string; provider: string; accountNumber: string; isActive: boolean; updatedAt: string }
type AdminMember = { id: string; userId: string; role: 'landlord_admin' | 'caretaker'; name: string; email: string; phone: string | null; rights: Record<AdminRightKey, boolean> }
type UserOpt = { id: string; name: string; email: string }

function Toggle({ enabled, onChange, label, desc }: { enabled: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200/70 bg-white/60 p-4 dark:border-white/10 dark:bg-slate-900/40">
      <div>
        <p className="font-medium text-slate-900 dark:text-white">{label}</p>
        {desc && <p className="text-sm text-slate-500 dark:text-slate-400">{desc}</p>}
      </div>
      <button type="button" onClick={() => onChange(!enabled)} className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${enabled ? 'bg-gradient-to-r from-fuchsia-500 to-cyan-500' : 'bg-slate-300 dark:bg-slate-600'}`} aria-pressed={enabled}>
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  )
}

function Field({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-800 dark:text-slate-200">{label}</label>
      {desc && <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">{desc}</p>}
      {children}
    </div>
  )
}

function Section({ id, icon: Icon, title, desc, color, children }: { id: string; icon: LucideIcon; title: string; desc: string; color: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
      <div className="mb-5 flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-lg ${color}`}><Icon className="h-5 w-5" /></span>
        <div><h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2><p className="text-sm text-slate-500 dark:text-slate-400">{desc}</p></div>
      </div>
      {children}
    </section>
  )
}

const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/20 dark:border-white/10 dark:bg-slate-900/60 dark:text-white'

const DEFAULT_SETTINGS = {
  general: { displayName: '', currency: 'USD', timezone: 'Africa/Nairobi', dateFormat: 'DD MMM YYYY', fiscalMonthStart: 1, defaultRentDueDay: 5 },
  branding: { accent: 'emerald-cyan', portalTagline: 'Property Workspace', showOwnerContact: true, compactMode: false },
  billing: { invoicePrefix: 'INV', graceDays: 5, lateFeeEnabled: false, lateFeeType: 'fixed', lateFeeValue: 0, allowPartialPayments: true, autoMarkOverdue: true, autoGenerateInvoices: false, generateDaysBeforeDue: 3, prorationOnMoveIn: true, receiptNumbering: 'auto' },
  payments: { acceptCash: true, acceptBank: true, acceptMpesa: true, acceptCard: false, autoReconcile: false, sendReceiptOnPayment: true, showPaymentInstructions: true },
  notifications: { rentReminder: true, reminderDaysBefore: 3, overdueReminder: true, overdueReminderEveryDays: 7, leaseExpiryAlert: true, leaseExpiryDays: 30, maintenanceUpdates: true, complaintUpdates: true, paymentReceived: true, weeklySummary: false },
  automation: { autoVacateOnLeaseEnd: false, autoOccupyOnLeaseStart: true, suggestRenewal: true, renewalLeadDays: 45, autoApplyLateFee: false, flagHighArrears: true, arrearsThreshold: 1 },
  leases: { minLeaseMonths: 6, maxLeaseMonths: 24, defaultBillingDay: 5, requireDeposit: true, allowEarlyTermination: true, noticePeriodDays: 30, documentChecklist: true },
  maintenance: { autoAcknowledge: true, defaultPriority: 'medium', slaLowHours: 72, slaMediumHours: 48, slaHighHours: 24, allowTenantPhotos: true, notifyOnStatusChange: true },
  complaints: { allowAnonymous: false, defaultResponseHours: 24, escalateAfterHours: 72, autoAssign: false, requireResolutionNote: true },
  team: { allowCaretakerCreateInvoices: false, allowCaretakerRecordPayments: true, allowCaretakerManageTickets: true, requireApprovalForExpenses: false, activityLogging: true },
}

type MergedSettings = { [K in keyof typeof DEFAULT_SETTINGS]: typeof DEFAULT_SETTINGS[K] }

function mergeSettings(db: Record<string, unknown> | null | undefined, orgName: string): MergedSettings {
  const d: Record<string, unknown> = db && typeof db === 'object' && !Array.isArray(db) ? db : {}
  const get = (k: keyof typeof DEFAULT_SETTINGS): Record<string, unknown> =>
    d[k] && typeof d[k] === 'object' && !Array.isArray(d[k]) ? (d[k] as Record<string, unknown>) : {}
  return {
    general: { ...DEFAULT_SETTINGS.general, displayName: orgName, ...get('general') },
    branding: { ...DEFAULT_SETTINGS.branding, ...get('branding') },
    billing: { ...DEFAULT_SETTINGS.billing, ...get('billing') },
    payments: { ...DEFAULT_SETTINGS.payments, ...get('payments') },
    notifications: { ...DEFAULT_SETTINGS.notifications, ...get('notifications') },
    automation: { ...DEFAULT_SETTINGS.automation, ...get('automation') },
    leases: { ...DEFAULT_SETTINGS.leases, ...get('leases') },
    maintenance: { ...DEFAULT_SETTINGS.maintenance, ...get('maintenance') },
    complaints: { ...DEFAULT_SETTINGS.complaints, ...get('complaints') },
    team: { ...DEFAULT_SETTINGS.team, ...get('team') },
  } as MergedSettings
}

export function MaskaniSettingsManager({ organization, orgQuery, roleLabel, stats, gateways, adminMembers, users, initialSettings }: { organization: Org; orgQuery: string; roleLabel: string; stats: Stats; gateways: Gateway[]; adminMembers: AdminMember[]; users: UserOpt[]; initialSettings?: Record<string, unknown> | null }) {
  const init = useMemo(() => mergeSettings(initialSettings, organization.name), [initialSettings, organization.name])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark' | 'system' | 'auto'>('system')

  const [general, setGeneral] = useState(init.general)
  const [branding, setBranding] = useState(init.branding)
  const [billing, setBilling] = useState(init.billing)
  const [payments, setPayments] = useState(init.payments)
  const [notifications, setNotifications] = useState(init.notifications)
  const [automation, setAutomation] = useState(init.automation)
  const [leases, setLeases] = useState(init.leases)
  const [maintenance, setMaintenance] = useState(init.maintenance)
  const [complaints, setComplaints] = useState(init.complaints)
  const [team, setTeam] = useState(init.team)
  const [gwProvider, setGwProvider] = useState<'mpesa_paybill' | 'mpesa_till' | 'paystack_subaccount' | 'bank_transfer'>('mpesa_paybill')

  const [isPending, startTransition] = useTransition()
  const [adminMode, setAdminMode] = useState<'existing' | 'new'>('existing')
  const [newRights, setNewRights] = useState<Record<AdminRightKey, boolean>>({ ...DEFAULT_ADMIN_RIGHTS })
  const [actionMsg, setActionMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const memberUserIds = useMemo(() => new Set(adminMembers.map((m) => m.userId)), [adminMembers])
  const availableUsers = useMemo(() => users.filter((u) => !memberUserIds.has(u.id)), [users, memberUserIds])

  const runAction = (fn: (fd: FormData) => Promise<void>, fd: FormData, ok: string) => {
    setActionMsg(null)
    startTransition(async () => {
      try { await fn(fd); setActionMsg({ type: 'ok', text: ok }) }
      catch (e) { setActionMsg({ type: 'err', text: e instanceof Error ? e.message : 'Action failed' }) }
    })
  }

  useEffect(() => {
    let id: number | undefined
    try {
      const t = localStorage.getItem('theme')
      const resolved = t === 'dark' || t === 'light' || t === 'auto' ? t : 'system'
      id = window.setTimeout(() => setTheme(resolved), 0)
    } catch {}
    return () => { if (id !== undefined) window.clearTimeout(id) }
  }, [])

  useEffect(() => {
    try { document.cookie = `ducksaas_currency=${encodeURIComponent(init.general.currency)}; path=/; max-age=31536000; samesite=lax` } catch {}
  }, [init.general.currency])

  const applyTheme = (t: 'light' | 'dark' | 'system' | 'auto') => {
    setTheme(t)
    try {
      if (t === 'system') localStorage.removeItem('theme')
      else localStorage.setItem('theme', t)
      const osDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const h = new Date().getHours()
      const night = h >= 19 || h < 6
      const dark = t === 'dark' || (t === 'auto' && (osDark || night)) || (t === 'system' && osDark)
      document.documentElement.classList.toggle('dark', dark)
    } catch {}
  }

  const flash = (msg: string) => { setSaved(msg); setTimeout(() => setSaved(null), 2500) }
  const persist = async (msg: string) => {
    setSaving(true)
    try {
      const payload = { general, branding, billing, payments, notifications, automation, leases, maintenance, complaints, team, updatedAt: new Date().toISOString() }
      await updateOrganizationSettings(organization.id, payload)
      document.cookie = `ducksaas_currency=${encodeURIComponent(general.currency)}; path=/; max-age=31536000; samesite=lax`
      flash(msg)
    } catch (e) { flash(e instanceof Error ? e.message : 'Failed to save settings') } finally { setSaving(false) }
  }

  const saveAll = () => persist('All Maskani settings saved')

  const nav = [
    { href: `/maskani${orgQuery}`, label: 'Dashboard' },
    { href: `/maskani/properties${orgQuery}`, label: 'Properties & Units' },
    { href: `/maskani/tenants${orgQuery}`, label: 'Tenants & Leases' },
    { href: `/maskani/invoices${orgQuery}`, label: 'Rent & Invoices' },
    { href: `/maskani/maintenance${orgQuery}`, label: 'Maintenance' },
    { href: `/maskani/complaints${orgQuery}`, label: 'Complaints' },
    { href: `/maskani/notifications${orgQuery}`, label: 'Notifications' },
    { href: `/maskani/reports${orgQuery}`, label: 'Reports' },
    { href: `/maskani/settings${orgQuery}`, label: 'Settings', active: true },
  ]

  const sectionNav = [
    { id: 'general', label: 'General & Identity' },
    { id: 'appearance', label: 'Appearance' },
    { id: 'billing', label: 'Rent & Billing Logic' },
    { id: 'payment-plan', label: 'Payment & Plan' },
    { id: 'notifications', label: 'Notifications & Alerts' },
    { id: 'automation', label: 'Automation Rules' },
    { id: 'leases', label: 'Lease & Vacancy' },
    { id: 'maintenance-policy', label: 'Maintenance SLA' },
    { id: 'complaints-policy', label: 'Complaints Policy' },
    { id: 'team', label: 'Team & Access' },
    { id: 'administrators', label: 'Administrator Users' },
  ]

  const readiness = useMemo(() => {
    const checks = [
      { label: 'Properties added', ok: stats.properties > 0, href: `/maskani/properties${orgQuery}` },
      { label: 'Units added', ok: stats.units > 0, href: `/maskani/properties${orgQuery}` },
      { label: 'Tenant/leases set', ok: stats.leases > 0, href: `/maskani/tenants${orgQuery}` },
      { label: 'Payment gateway configured', ok: gateways.length > 0, href: '#payment-plan' },
      { label: 'Subscription plan assigned', ok: !!organization.subscriptionPlan, href: '#payment-plan' },
    ]
    const score = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100)
    return { checks, score }
  }, [stats, gateways, organization.subscriptionPlan, orgQuery])

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-100 text-slate-900 transition-colors dark:bg-slate-950 dark:text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-fuchsia-400/25 blur-3xl dark:bg-fuchsia-600/20" />
        <div className="absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full bg-cyan-400/25 blur-3xl dark:bg-cyan-500/20" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl dark:bg-emerald-500/15" />
      </div>
      <div className="relative flex min-h-screen">
        <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-200/80 bg-white/70 p-6 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/60 md:flex">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-lg"><Sparkles className="h-6 w-6 text-white" /></div>
            <div className="min-w-0"><h1 className="truncate text-lg font-bold tracking-tight" title={organization.name}>{organization.name}</h1><p className="text-xs text-slate-500 dark:text-slate-400">Property Workspace</p></div>
          </div>
          <nav className="flex-1 space-y-1.5">{nav.map((n) => <Link key={n.href} href={n.href} className={`block rounded-xl px-4 py-2.5 text-sm font-medium transition ${n.active ? 'bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white shadow-lg shadow-fuchsia-500/20' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white'}`}>{n.label}</Link>)}</nav>
          <div className="mt-6 border-t border-slate-200 pt-6 dark:border-white/10"><a href="/auth/signout" className="block rounded-xl px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10">Sign Out</a></div>
        </aside>
        <main className="flex-1 p-6 lg:p-10">
          <MobileNav items={nav} title={organization.name} />
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
              <div>
                <Link href={`/maskani${orgQuery}`} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to dashboard</Link>
                <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-fuchsia-400/40 bg-fuchsia-500/10 px-3 py-1 text-xs font-medium text-fuchsia-700 dark:text-fuchsia-200"><Settings className="h-3.5 w-3.5" /> Master Logic Settings</p>
                <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">Landlord Portal Settings</h2>
                <p className="mt-1 text-slate-600 dark:text-slate-400">{organization.name} · Role: {roleLabel} · Configure all Maskani behavior, billing logic, automation, and policies</p>
              </div>
              <div className="flex items-center gap-3">
                {saved && <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" /> {saved}</div>}
                <button onClick={saveAll} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg"><Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save All'}</button>
              </div>
            </div>
            <div className="mb-8 grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5 lg:col-span-2">
                <div className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-2 font-semibold"><Gauge className="h-5 w-5 text-fuchsia-500" /> Workspace Readiness</h3><span className="text-sm font-semibold text-fuchsia-700 dark:text-fuchsia-300">{readiness.score}%</span></div>
                <div className="mb-4 h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-500" style={{ width: `${readiness.score}%` }} /></div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {readiness.checks.map((c) => (
                    <a key={c.label} href={c.href} className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition ${c.ok ? 'border-emerald-200/70 bg-emerald-500/10 text-emerald-800 dark:border-emerald-500/20 dark:text-emerald-200' : 'border-amber-200/70 bg-amber-500/10 text-amber-800 dark:border-amber-500/20 dark:text-amber-200'}`}>
                      <span className="inline-flex items-center gap-2">{c.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />} {c.label}</span>
                      <ChevronRight className="h-4 w-4 opacity-60" />
                    </a>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <h3 className="mb-3 font-semibold">Organization Snapshot</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Name</dt><dd className="font-medium">{organization.name}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Slug</dt><dd className="font-medium">{organization.slug}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Status</dt><dd><span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${organization.status === 'active' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : organization.status === 'grace_period' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'}`}>{organization.status.replace('_', ' ')}</span></dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Owner</dt><dd className="text-right font-medium">{organization.owner.name}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Plan</dt><dd className="font-medium">{organization.subscriptionPlan?.name || 'None'}</dd></div>
                </dl>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-slate-100 p-2 dark:bg-white/5"><p className="font-bold text-slate-900 dark:text-white">{stats.properties}</p><p className="text-slate-500">Props</p></div>
                  <div className="rounded-lg bg-slate-100 p-2 dark:bg-white/5"><p className="font-bold text-slate-900 dark:text-white">{stats.units}</p><p className="text-slate-500">Units</p></div>
                  <div className="rounded-lg bg-slate-100 p-2 dark:bg-white/5"><p className="font-bold text-slate-900 dark:text-white">{stats.leases}</p><p className="text-slate-500">Leases</p></div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-8 lg:flex-row">
              <nav className="shrink-0 lg:sticky lg:top-24 lg:w-56 lg:self-start">
                <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-3 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                  <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Sections</p>
                  <div className="flex flex-row flex-wrap gap-1 lg:flex-col">{sectionNav.map((n) => <a key={n.id} href={`#${n.id}`} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white">{n.label}</a>)}</div>
                </div>
              </nav>
              <div className="min-w-0 flex-1 space-y-6">
                <Section id="general" icon={Building2} title="General & Identity" desc="Workspace identity, regional defaults, and base operating parameters for this landlord portal." color="bg-gradient-to-br from-cyan-500 to-blue-600">
                  <div className="mb-4 rounded-xl border border-cyan-200/60 bg-cyan-500/10 p-4 text-sm text-cyan-800 dark:border-cyan-500/20 dark:text-cyan-200">Portal identity is anchored to <strong>{organization.name}</strong> (slug: <code>{organization.slug}</code>). Preferences are saved server-side in PostgreSQL.</div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Display name"><input className={inputCls} value={general.displayName} onChange={(e) => setGeneral({ ...general, displayName: e.target.value })} /></Field>
                    <Field label="Default currency"><select className={inputCls} value={general.currency} onChange={(e) => setGeneral({ ...general, currency: e.target.value })}><option>USD</option><option>KES</option><option>EUR</option><option>GBP</option><option>NGN</option><option>TZS</option><option>UGX</option></select></Field>
                    <Field label="Timezone"><input className={inputCls} value={general.timezone} onChange={(e) => setGeneral({ ...general, timezone: e.target.value })} /></Field>
                    <Field label="Date format"><select className={inputCls} value={general.dateFormat} onChange={(e) => setGeneral({ ...general, dateFormat: e.target.value })}><option value="DD MMM YYYY">DD MMM YYYY</option><option value="YYYY-MM-DD">YYYY-MM-DD</option><option value="MM/DD/YYYY">MM/DD/YYYY</option><option value="DD/MM/YYYY">DD/MM/YYYY</option></select></Field>
                    <Field label="Fiscal month start (1-28)"><input className={inputCls} type="number" min={1} max={28} value={general.fiscalMonthStart} onChange={(e) => setGeneral({ ...general, fiscalMonthStart: +e.target.value })} /></Field>
                    <Field label="Default rent due day (1-28)"><input className={inputCls} type="number" min={1} max={28} value={general.defaultRentDueDay} onChange={(e) => setGeneral({ ...general, defaultRentDueDay: +e.target.value })} /></Field>
                  </div>
                  <div className="mt-4 flex justify-end"><button onClick={() => persist('General settings saved')} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"><Save className="h-4 w-4" /> Save</button></div>
                </Section>

                <Section id="appearance" icon={Palette} title="Appearance & Portal Experience" desc="Theme and landlord portal presentation preferences." color="bg-gradient-to-br from-fuchsia-500 to-pink-600">
                  <p className="mb-3 text-sm font-medium text-slate-800 dark:text-slate-200">Theme (browser preference)</p>
                  <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {([{ v: 'light', label: 'Light', icon: Sun }, { v: 'dark', label: 'Dark', icon: Moon }, { v: 'system', label: 'System', icon: Monitor }, { v: 'auto', label: 'Auto', icon: SunMoon }] as const).map((opt) => {
                      const Icon = opt.icon; const active = theme === opt.v
                      return <button key={opt.v} onClick={() => { applyTheme(opt.v); flash('Theme updated') }} className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${active ? 'border-fuchsia-500 bg-fuchsia-500/10 ring-1 ring-fuchsia-500/30' : 'border-slate-200 bg-white/60 hover:border-slate-300 dark:border-white/10 dark:bg-slate-900/40 dark:hover:border-white/20'}`}><Icon className={`h-5 w-5 ${active ? 'text-fuchsia-600 dark:text-fuchsia-300' : 'text-slate-500'}`} /><span className="font-medium text-slate-900 dark:text-white">{opt.label}</span></button>
                    })}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Accent style"><select className={inputCls} value={branding.accent} onChange={(e) => setBranding({ ...branding, accent: e.target.value })}><option value="emerald-cyan">Emerald & Cyan</option><option value="violet-fuchsia">Violet & Fuchsia</option><option value="amber-orange">Amber & Orange</option><option value="blue-indigo">Blue & Indigo</option></select></Field>
                    <Field label="Portal tagline"><input className={inputCls} value={branding.portalTagline} onChange={(e) => setBranding({ ...branding, portalTagline: e.target.value })} /></Field>
                  </div>
                  <div className="mt-4 space-y-3">
                    <Toggle enabled={branding.showOwnerContact} onChange={(v) => setBranding({ ...branding, showOwnerContact: v })} label="Show owner contact in workspace" desc="Display owner details in organization/settings context." />
                    <Toggle enabled={branding.compactMode} onChange={(v) => setBranding({ ...branding, compactMode: v })} label="Compact tables and cards" desc="Prefer denser layouts for high-volume portfolios." />
                  </div>
                  <div className="mt-4 flex justify-end"><button onClick={() => persist('Appearance settings saved')} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"><Save className="h-4 w-4" /> Save</button></div>
                </Section>

                <Section id="billing" icon={ReceiptText} title="Rent & Billing Logic" desc="Advanced invoice behavior, due dates, grace periods, late fees, and collection rules." color="bg-gradient-to-br from-violet-500 to-purple-600">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Invoice prefix"><input className={inputCls} value={billing.invoicePrefix} onChange={(e) => setBilling({ ...billing, invoicePrefix: e.target.value })} /></Field>
                    <Field label="Grace period (days)"><input className={inputCls} type="number" min={0} value={billing.graceDays} onChange={(e) => setBilling({ ...billing, graceDays: +e.target.value })} /></Field>
                    <Field label="Generate invoices (days before due)"><input className={inputCls} type="number" min={0} value={billing.generateDaysBeforeDue} onChange={(e) => setBilling({ ...billing, generateDaysBeforeDue: +e.target.value })} /></Field>
                    <Field label="Late fee type"><select className={inputCls} value={billing.lateFeeType} onChange={(e) => setBilling({ ...billing, lateFeeType: e.target.value })}><option value="fixed">Fixed amount</option><option value="percent">Percentage of rent</option><option value="daily">Daily amount</option></select></Field>
                    <Field label="Late fee value"><input className={inputCls} type="number" min={0} step="0.01" value={billing.lateFeeValue} onChange={(e) => setBilling({ ...billing, lateFeeValue: +e.target.value })} /></Field>
                    <Field label="Receipt numbering"><select className={inputCls} value={billing.receiptNumbering} onChange={(e) => setBilling({ ...billing, receiptNumbering: e.target.value })}><option value="auto">Automatic</option><option value="manual">Manual</option></select></Field>
                  </div>
                  <div className="mt-4 space-y-3">
                    <Toggle enabled={billing.allowPartialPayments} onChange={(v) => setBilling({ ...billing, allowPartialPayments: v })} label="Allow partial rent payments" desc="Track outstanding balances when tenants pay in installments." />
                    <Toggle enabled={billing.autoMarkOverdue} onChange={(v) => setBilling({ ...billing, autoMarkOverdue: v })} label="Auto-mark invoices overdue" desc="Flag unpaid invoices after due date + grace period." />
                    <Toggle enabled={billing.autoGenerateInvoices} onChange={(v) => setBilling({ ...billing, autoGenerateInvoices: v })} label="Auto-generate recurring rent invoices" desc="Prepare invoices ahead of each billing cycle (policy)." />
                    <Toggle enabled={billing.lateFeeEnabled} onChange={(v) => setBilling({ ...billing, lateFeeEnabled: v })} label="Enable late fee policy" desc="Apply configured late fee logic to overdue balances." />
                    <Toggle enabled={billing.prorationOnMoveIn} onChange={(v) => setBilling({ ...billing, prorationOnMoveIn: v })} label="Prorate first-month rent on move-in" desc="Calculate partial rent for mid-cycle occupancy starts." />
                  </div>
                  <div className="mt-4 flex justify-end"><button onClick={() => persist('Billing logic saved')} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"><Save className="h-4 w-4" /> Save</button></div>
                </Section>

                <Section id="payment-plan" icon={CreditCard} title="Payment & Plan" desc="Subscription plan (SaaS), landlord rent-collection gateways, and payment preferences." color="bg-gradient-to-br from-emerald-500 to-teal-600">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-violet-200/60 bg-violet-500/10 p-4 dark:border-violet-500/20">
                      <p className="mb-2 flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><BadgeDollarSign className="h-4 w-4 text-violet-500" /> Subscription Plan</p>
                      {organization.subscriptionPlan ? (
                        <div className="space-y-1 text-sm">
                          <p className="text-lg font-bold text-slate-900 dark:text-white">{organization.subscriptionPlan.name}</p>
                          <p className="text-slate-700 dark:text-slate-200">{organization.subscriptionPlan.currency} {organization.subscriptionPlan.priceMonthly}/mo · {organization.subscriptionPlan.currency} {organization.subscriptionPlan.priceYearly}/yr</p>
                          <p className="text-slate-600 dark:text-slate-300">Max units: {organization.subscriptionPlan.maxUnits} · {organization.subscriptionPlan.isActive ? 'Active plan' : 'Inactive plan'}</p>
                          <p className="text-slate-600 dark:text-slate-300">Subscription ends: {organization.subscriptionEndsAt ? organization.subscriptionEndsAt.slice(0, 10) : 'Not set'}</p>
                        </div>
                      ) : (
                        <p className="text-sm text-amber-800 dark:text-amber-200">No subscription plan assigned. Managed by DuckSaaS super admin.</p>
                      )}
                    </div>
                    <div className="rounded-xl border border-slate-200/70 bg-white/60 p-4 dark:border-white/10 dark:bg-slate-900/40">
                      <p className="mb-2 flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><Wallet className="h-4 w-4 text-emerald-500" /> Landlord Payment Gateways</p>
                      {gateways.length === 0 ? (
                        <p className="text-sm text-slate-600 dark:text-slate-300">No gateways configured. Add M-Pesa Paybill/Till, Paystack, or bank transfer below so tenants can pay rent online.</p>
                      ) : (
                        <div className="space-y-2">{gateways.map((g) => (
                          <div key={g.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/70 bg-white/70 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5">
                            <div className="min-w-0"><span className="font-medium capitalize">{g.provider.replace(/_/g, ' ')}</span><span className="ml-2 text-slate-500 dark:text-slate-400">{g.accountNumber}</span></div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <button type="button" onClick={() => { const fd = new FormData(); fd.set('orgId', organization.id); fd.set('id', g.id); fd.set('isActive', String(!g.isActive)); runAction(setPaymentGatewayActive, fd, g.isActive ? 'Gateway disabled' : 'Gateway enabled') }} className={`rounded-full px-2 py-0.5 text-xs ${g.isActive ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-slate-500/15 text-slate-600 dark:text-slate-300'}`}>{g.isActive ? 'Active' : 'Off'}</button>
                              <button type="button" onClick={() => { if (confirm(`Remove ${g.provider.replace(/_/g, ' ')} gateway?`)) { const fd = new FormData(); fd.set('orgId', organization.id); fd.set('id', g.id); runAction(deletePaymentGateway, fd, 'Gateway removed') } }} className="rounded-lg p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </div>
                        ))}</div>
                      )}
                      <form action={(fd) => { fd.set('orgId', organization.id); runAction(upsertPaymentGateway, fd, 'Gateway saved — tenants can now pay with it') }} className="mt-4 space-y-3 rounded-xl border border-dashed border-slate-300 p-4 dark:border-white/15">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">Add / update gateway</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs font-medium">Provider</label>
                            <select value={gwProvider} onChange={(e) => setGwProvider(e.target.value as typeof gwProvider)} className={inputCls}>
                              <option value="mpesa_paybill">M-Pesa Paybill</option>
                              <option value="mpesa_till">M-Pesa Till (Buy Goods)</option>
                              <option value="paystack_subaccount">Card (Paystack)</option>
                              <option value="bank_transfer">Bank transfer</option>
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium">{gwProvider === 'bank_transfer' ? 'Account number' : gwProvider.startsWith('mpesa') ? 'Shortcode / Till number' : 'Account / reference'}</label>
                            <input name="accountNumber" required className={inputCls} placeholder={gwProvider === 'bank_transfer' ? 'e.g. 0123456789' : 'e.g. 123456'} />
                          </div>
                        </div>
                        {(gwProvider === 'mpesa_paybill' || gwProvider === 'mpesa_till') && (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div><label className="mb-1 block text-xs font-medium">Consumer key</label><input name="cred_consumerKey" className={inputCls} placeholder="Daraja consumer key" /></div>
                            <div><label className="mb-1 block text-xs font-medium">Consumer secret</label><input name="cred_consumerSecret" type="password" className={inputCls} placeholder="Leave blank to keep existing" /></div>
                            <div><label className="mb-1 block text-xs font-medium">Passkey</label><input name="cred_passkey" type="password" className={inputCls} placeholder="Leave blank to keep existing" /></div>
                            <div><label className="mb-1 block text-xs font-medium">Shortcode (optional override)</label><input name="cred_shortcode" className={inputCls} placeholder="Defaults to account number" /></div>
                          </div>
                        )}
                        {gwProvider === 'paystack_subaccount' && (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div><label className="mb-1 block text-xs font-medium">Secret key</label><input name="cred_secretKey" type="password" required className={inputCls} placeholder="sk_test_... / sk_live_..." /></div>
                            <div><label className="mb-1 block text-xs font-medium">Currency</label><input name="cred_currency" className={inputCls} placeholder="KES" defaultValue="KES" /></div>
                          </div>
                        )}
                        {gwProvider === 'bank_transfer' && (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div><label className="mb-1 block text-xs font-medium">Bank name</label><input name="cred_bankName" required className={inputCls} placeholder="e.g. KCB, Equity" /></div>
                            <div><label className="mb-1 block text-xs font-medium">Account name</label><input name="cred_accountName" className={inputCls} placeholder="e.g. Kamau Properties Ltd" /></div>
                          </div>
                        )}
                        <div className="flex justify-end"><button type="submit" disabled={isPending} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-slate-900">{isPending ? 'Saving…' : 'Save gateway'}</button></div>
                      </form>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    <Toggle enabled={payments.acceptCash} onChange={(v) => setPayments({ ...payments, acceptCash: v })} label="Accept cash (manual recording)" desc="Allow recording cash rent payments." />
                    <Toggle enabled={payments.acceptBank} onChange={(v) => setPayments({ ...payments, acceptBank: v })} label="Accept bank transfers" desc="Enable bank transfer as a payment method." />
                    <Toggle enabled={payments.acceptMpesa} onChange={(v) => setPayments({ ...payments, acceptMpesa: v })} label="Accept M-Pesa" desc="Enable M-Pesa STK/C2B collection where configured." />
                    <Toggle enabled={payments.acceptCard} onChange={(v) => setPayments({ ...payments, acceptCard: v })} label="Accept card payments" desc="Enable card collection where gateway supports it." />
                    <Toggle enabled={payments.sendReceiptOnPayment} onChange={(v) => setPayments({ ...payments, sendReceiptOnPayment: v })} label="Auto-send receipt on payment" desc="Notify tenant when a payment is recorded." />
                    <Toggle enabled={payments.autoReconcile} onChange={(v) => setPayments({ ...payments, autoReconcile: v })} label="Auto-reconcile gateway references" desc="Match incoming transaction references to invoices when possible." />
                  </div>
                  <div className="mt-4 flex flex-wrap justify-between gap-3">
                    <Link href={`/maskani/invoices${orgQuery}`} className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-300"><ExternalLink className="h-4 w-4" /> Open Rent & Invoices</Link>
                    <button onClick={() => persist('Payment & plan settings saved')} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"><Save className="h-4 w-4" /> Save</button>
                  </div>
                </Section>

                <Section id="notifications" icon={Bell} title="Notifications & Alerts" desc="Proactive reminders for rent, arrears, lease events, maintenance, and complaints." color="bg-gradient-to-br from-sky-500 to-indigo-600">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Rent reminder (days before due)"><input className={inputCls} type="number" min={0} value={notifications.reminderDaysBefore} onChange={(e) => setNotifications({ ...notifications, reminderDaysBefore: +e.target.value })} /></Field>
                    <Field label="Overdue reminder frequency (days)"><input className={inputCls} type="number" min={1} value={notifications.overdueReminderEveryDays} onChange={(e) => setNotifications({ ...notifications, overdueReminderEveryDays: +e.target.value })} /></Field>
                    <Field label="Lease expiry alert (days before)"><input className={inputCls} type="number" min={1} value={notifications.leaseExpiryDays} onChange={(e) => setNotifications({ ...notifications, leaseExpiryDays: +e.target.value })} /></Field>
                  </div>
                  <div className="mt-4 space-y-3">
                    <Toggle enabled={notifications.rentReminder} onChange={(v) => setNotifications({ ...notifications, rentReminder: v })} label="Upcoming rent reminders" desc="Alert tenants/landlord before rent is due." />
                    <Toggle enabled={notifications.overdueReminder} onChange={(v) => setNotifications({ ...notifications, overdueReminder: v })} label="Overdue/arrears reminders" desc="Escalate reminders for unpaid balances." />
                    <Toggle enabled={notifications.leaseExpiryAlert} onChange={(v) => setNotifications({ ...notifications, leaseExpiryAlert: v })} label="Lease expiry & vacating alerts" desc="Highlight leases ending soon (about-to-vacate)." />
                    <Toggle enabled={notifications.paymentReceived} onChange={(v) => setNotifications({ ...notifications, paymentReceived: v })} label="Payment received alerts" desc="Notify on recorded rent payments." />
                    <Toggle enabled={notifications.maintenanceUpdates} onChange={(v) => setNotifications({ ...notifications, maintenanceUpdates: v })} label="Maintenance status updates" desc="Notify on ticket creation and progress." />
                    <Toggle enabled={notifications.complaintUpdates} onChange={(v) => setNotifications({ ...notifications, complaintUpdates: v })} label="Complaint updates" desc="Notify on complaint submission and resolution." />
                    <Toggle enabled={notifications.weeklySummary} onChange={(v) => setNotifications({ ...notifications, weeklySummary: v })} label="Weekly operations summary" desc="Digest of income, arrears, vacancies, and tickets." />
                  </div>
                  <div className="mt-4 flex justify-end"><button onClick={() => persist('Notification settings saved')} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"><Save className="h-4 w-4" /> Save</button></div>
                </Section>

                <Section id="automation" icon={Workflow} title="Automation Rules" desc="Smart workflow logic for occupancy, renewals, arrears, and operational efficiency." color="bg-gradient-to-br from-amber-500 to-orange-600">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Renewal suggestion lead time (days)"><input className={inputCls} type="number" min={1} value={automation.renewalLeadDays} onChange={(e) => setAutomation({ ...automation, renewalLeadDays: +e.target.value })} /></Field>
                    <Field label="High arrears threshold (unpaid invoices)"><input className={inputCls} type="number" min={1} value={automation.arrearsThreshold} onChange={(e) => setAutomation({ ...automation, arrearsThreshold: +e.target.value })} /></Field>
                  </div>
                  <div className="mt-4 space-y-3">
                    <Toggle enabled={automation.autoOccupyOnLeaseStart} onChange={(v) => setAutomation({ ...automation, autoOccupyOnLeaseStart: v })} label="Auto-mark unit occupied on active lease" desc="Sync unit status when an active lease is created." />
                    <Toggle enabled={automation.autoVacateOnLeaseEnd} onChange={(v) => setAutomation({ ...automation, autoVacateOnLeaseEnd: v })} label="Auto-mark unit vacant on lease end" desc="Release unit when lease expires or is terminated (policy)." />
                    <Toggle enabled={automation.suggestRenewal} onChange={(v) => setAutomation({ ...automation, suggestRenewal: v })} label="Suggest lease renewals" desc="Prompt renewal actions before expiry window." />
                    <Toggle enabled={automation.autoApplyLateFee} onChange={(v) => setAutomation({ ...automation, autoApplyLateFee: v })} label="Auto-apply late fee rules" desc="Apply configured late fees to overdue invoices (policy)." />
                    <Toggle enabled={automation.flagHighArrears} onChange={(v) => setAutomation({ ...automation, flagHighArrears: v })} label="Flag high-arrears tenants" desc="Highlight tenants exceeding arrears threshold on dashboard." />
                  </div>
                  <div className="mt-4 flex justify-end"><button onClick={() => persist('Automation rules saved')} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"><Save className="h-4 w-4" /> Save</button></div>
                </Section>

                <Section id="leases" icon={CalendarClock} title="Lease & Vacancy Policy" desc="Default lease terms, billing behavior, deposits, notice periods, and vacancy handling." color="bg-gradient-to-br from-cyan-500 to-blue-600">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Min lease duration (months)"><input className={inputCls} type="number" min={1} value={leases.minLeaseMonths} onChange={(e) => setLeases({ ...leases, minLeaseMonths: +e.target.value })} /></Field>
                    <Field label="Max lease duration (months)"><input className={inputCls} type="number" min={1} value={leases.maxLeaseMonths} onChange={(e) => setLeases({ ...leases, maxLeaseMonths: +e.target.value })} /></Field>
                    <Field label="Default billing day (1-28)"><input className={inputCls} type="number" min={1} max={28} value={leases.defaultBillingDay} onChange={(e) => setLeases({ ...leases, defaultBillingDay: +e.target.value })} /></Field>
                    <Field label="Notice period (days)"><input className={inputCls} type="number" min={0} value={leases.noticePeriodDays} onChange={(e) => setLeases({ ...leases, noticePeriodDays: +e.target.value })} /></Field>
                  </div>
                  <div className="mt-4 space-y-3">
                    <Toggle enabled={leases.requireDeposit} onChange={(v) => setLeases({ ...leases, requireDeposit: v })} label="Require security deposit" desc="Expect deposit capture for new leases/units." />
                    <Toggle enabled={leases.allowEarlyTermination} onChange={(v) => setLeases({ ...leases, allowEarlyTermination: v })} label="Allow early termination workflow" desc="Support managed early lease termination." />
                    <Toggle enabled={leases.documentChecklist} onChange={(v) => setLeases({ ...leases, documentChecklist: v })} label="Lease document checklist" desc="Prompt for required documents during onboarding." />
                  </div>
                  <div className="mt-4 flex justify-end"><button onClick={() => persist('Lease settings saved')} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"><Save className="h-4 w-4" /> Save</button></div>
                </Section>

                <Section id="maintenance-policy" icon={Wrench} title="Maintenance SLA & Operations" desc="Ticket handling defaults, response SLAs, and maintenance workflow preferences." color="bg-gradient-to-br from-rose-500 to-pink-600">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Default priority"><select className={inputCls} value={maintenance.defaultPriority} onChange={(e) => setMaintenance({ ...maintenance, defaultPriority: e.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></Field>
                    <Field label="SLA: High (hours)"><input className={inputCls} type="number" min={1} value={maintenance.slaHighHours} onChange={(e) => setMaintenance({ ...maintenance, slaHighHours: +e.target.value })} /></Field>
                    <Field label="SLA: Medium (hours)"><input className={inputCls} type="number" min={1} value={maintenance.slaMediumHours} onChange={(e) => setMaintenance({ ...maintenance, slaMediumHours: +e.target.value })} /></Field>
                    <Field label="SLA: Low (hours)"><input className={inputCls} type="number" min={1} value={maintenance.slaLowHours} onChange={(e) => setMaintenance({ ...maintenance, slaLowHours: +e.target.value })} /></Field>
                  </div>
                  <div className="mt-4 space-y-3">
                    <Toggle enabled={maintenance.autoAcknowledge} onChange={(v) => setMaintenance({ ...maintenance, autoAcknowledge: v })} label="Auto-acknowledge new tickets" desc="Mark new maintenance requests as acknowledged." />
                    <Toggle enabled={maintenance.allowTenantPhotos} onChange={(v) => setMaintenance({ ...maintenance, allowTenantPhotos: v })} label="Allow tenant photo attachments" desc="Accept photos with maintenance reports." />
                    <Toggle enabled={maintenance.notifyOnStatusChange} onChange={(v) => setMaintenance({ ...maintenance, notifyOnStatusChange: v })} label="Notify on status changes" desc="Alert reporter when ticket progresses/resolves." />
                  </div>
                  <div className="mt-4 flex justify-end"><button onClick={() => persist('Maintenance policy saved')} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"><Save className="h-4 w-4" /> Save</button></div>
                </Section>

                <Section id="complaints-policy" icon={MessageSquareWarning} title="Complaints & Escalation Policy" desc="Complaint intake, response targets, and escalation rules for tenant issues." color="bg-gradient-to-br from-orange-500 to-red-600">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Default response target (hours)"><input className={inputCls} type="number" min={1} value={complaints.defaultResponseHours} onChange={(e) => setComplaints({ ...complaints, defaultResponseHours: +e.target.value })} /></Field>
                    <Field label="Escalate if unresolved after (hours)"><input className={inputCls} type="number" min={1} value={complaints.escalateAfterHours} onChange={(e) => setComplaints({ ...complaints, escalateAfterHours: +e.target.value })} /></Field>
                  </div>
                  <div className="mt-4 space-y-3">
                    <Toggle enabled={complaints.requireResolutionNote} onChange={(v) => setComplaints({ ...complaints, requireResolutionNote: v })} label="Require resolution note" desc="Capture resolution details before closing a complaint." />
                    <Toggle enabled={complaints.autoAssign} onChange={(v) => setComplaints({ ...complaints, autoAssign: v })} label="Auto-assign complaints" desc="Route new complaints to default handler/caretaker (policy)." />
                    <Toggle enabled={complaints.allowAnonymous} onChange={(v) => setComplaints({ ...complaints, allowAnonymous: v })} label="Allow anonymous submissions" desc="Permit complaints without identifying the reporter." />
                  </div>
                  <div className="mt-4 flex justify-end"><button onClick={() => persist('Complaints policy saved')} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"><Save className="h-4 w-4" /> Save</button></div>
                </Section>

                <Section id="team" icon={UserCog} title="Team & Access Controls" desc="Role permissions, operational guardrails, and activity tracking for this organization." color="bg-gradient-to-br from-slate-600 to-slate-800">
                  <div className="space-y-3">
                    <Toggle enabled={team.allowCaretakerRecordPayments} onChange={(v) => setTeam({ ...team, allowCaretakerRecordPayments: v })} label="Caretakers can record payments" desc="Permit caretaker role to log rent collections." />
                    <Toggle enabled={team.allowCaretakerCreateInvoices} onChange={(v) => setTeam({ ...team, allowCaretakerCreateInvoices: v })} label="Caretakers can create invoices" desc="Allow invoice generation by caretaker role." />
                    <Toggle enabled={team.allowCaretakerManageTickets} onChange={(v) => setTeam({ ...team, allowCaretakerManageTickets: v })} label="Caretakers can manage maintenance tickets" desc="Enable ticket triage and status updates by caretakers." />
                    <Toggle enabled={team.requireApprovalForExpenses} onChange={(v) => setTeam({ ...team, requireApprovalForExpenses: v })} label="Require approval for expenses" desc="Gate expense actions behind admin approval (policy)." />
                    <Toggle enabled={team.activityLogging} onChange={(v) => setTeam({ ...team, activityLogging: v })} label="Activity logging" desc="Track key actions for accountability and audit." />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-sm">
                    <Link href={`/maskani/tenants${orgQuery}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-300/70 bg-white/60 px-3 py-2 font-medium text-slate-700 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200"><Users className="h-4 w-4" /> Members & Tenants</Link>
                    <Link href={`/maskani/complaints${orgQuery}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-300/70 bg-white/60 px-3 py-2 font-medium text-slate-700 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200"><MessageSquareWarning className="h-4 w-4" /> Complaints</Link>
                  </div>
                  <div className="mt-4 flex justify-end"><button onClick={() => persist('Team & access settings saved')} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"><Save className="h-4 w-4" /> Save</button></div>
                </Section>

                <Section id="administrators" icon={Shield} title="Administrator Users & Rights" desc="Add landlord admins/caretakers and configure per-user rights for this organization (persisted to database)." color="bg-gradient-to-br from-indigo-500 to-violet-600">
                  {actionMsg && <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${actionMsg.type === 'ok' ? 'border-emerald-200/70 bg-emerald-500/10 text-emerald-800 dark:border-emerald-500/20 dark:text-emerald-200' : 'border-rose-200/70 bg-rose-500/10 text-rose-800 dark:border-rose-500/20 dark:text-rose-200'}`}>{actionMsg.text}</div>}
                  <div className="mb-6 space-y-3">
                    {adminMembers.length === 0 ? (
                      <p className="text-sm text-slate-600 dark:text-slate-300">No administrator members yet. Add one below.</p>
                    ) : adminMembers.map((m) => (
                      <form key={m.id} action={(fd) => { fd.set('orgId', organization.id); fd.set('memberId', m.id); runAction(updateOrganizationAdmin, fd, 'Administrator updated') }} className="rounded-xl border border-slate-200/70 bg-white/60 p-4 dark:border-white/10 dark:bg-slate-900/40">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">{m.name} <span className="ml-1 text-xs font-normal text-slate-500">({m.email})</span>{m.userId === organization.ownerUserId && <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">Owner</span>}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{m.phone || 'No phone'} · DB-backed rights</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <select name="role" defaultValue={m.role} className={`${inputCls} !w-auto !py-1.5`}><option value="landlord_admin">Landlord Admin</option><option value="caretaker">Caretaker</option></select>
                            <button type="submit" disabled={isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"><Save className="h-3.5 w-3.5" /> Save</button>
                            {m.userId !== organization.ownerUserId && (
                              <button type="button" disabled={isPending} onClick={() => { if (!confirm(`Remove ${m.name} from this organization?`)) return; const fd = new FormData(); fd.set('orgId', organization.id); fd.set('memberId', m.id); runAction(removeOrganizationAdmin, fd, 'Administrator removed') }} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"><Trash2 className="h-3.5 w-3.5" /> Remove</button>
                            )}
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          {ADMIN_RIGHT_KEYS.map((k) => (
                            <label key={k} className="flex items-center gap-2 rounded-lg border border-slate-200/60 bg-white/70 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5">
                              <input type="checkbox" name={`right_${k}`} defaultChecked={!!m.rights[k]} className="h-4 w-4 rounded border-slate-300 text-fuchsia-600 focus:ring-fuchsia-500" />
                              <span className="text-slate-700 dark:text-slate-200">{RIGHT_LABELS[k]}</span>
                            </label>
                          ))}
                        </div>
                      </form>
                    ))}
                  </div>

                  <div className="rounded-xl border border-indigo-200/60 bg-indigo-500/10 p-4 dark:border-indigo-500/20">
                    <p className="mb-3 flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><UserPlus className="h-4 w-4 text-indigo-500" /> Add administrator / staff user</p>
                    <form action={(fd) => { fd.set('orgId', organization.id); ADMIN_RIGHT_KEYS.forEach((k) => fd.set(`right_${k}`, newRights[k] ? 'true' : 'false')); runAction(addOrganizationAdmin, fd, 'Administrator added') }} className="space-y-4">
                      <div className="flex flex-wrap gap-3">
                        <label className="inline-flex items-center gap-2 text-sm"><input type="radio" name="mode" value="existing" checked={adminMode === 'existing'} onChange={() => setAdminMode('existing')} /> Existing user</label>
                        <label className="inline-flex items-center gap-2 text-sm"><input type="radio" name="mode" value="new" checked={adminMode === 'new'} onChange={() => setAdminMode('new')} /> Create new user</label>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        {adminMode === 'existing' ? (
                          <Field label="Select user"><select name="userId" className={inputCls} required><option value="">Choose user...</option>{availableUsers.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}</select></Field>
                        ) : (
                          <>
                            <Field label="Full name"><input name="name" className={inputCls} required /></Field>
                            <Field label="Email"><input name="email" type="email" className={inputCls} required /></Field>
                            <Field label="Phone"><input name="phone" className={inputCls} /></Field>
                            <Field label="Password (min 8)"><input name="password" type="password" minLength={8} className={inputCls} required /></Field>
                          </>
                        )}
                        <Field label="Role"><select name="role" className={inputCls} defaultValue="landlord_admin"><option value="landlord_admin">Landlord Admin</option><option value="caretaker">Caretaker / Staff</option></select></Field>
                      </div>
                      <div>
                        <p className="mb-2 text-sm font-medium text-slate-800 dark:text-slate-200">Rights / permissions</p>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          {ADMIN_RIGHT_KEYS.map((k) => (
                            <label key={k} className="flex items-center gap-2 rounded-lg border border-slate-200/60 bg-white/70 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5">
                              <input type="checkbox" checked={!!newRights[k]} onChange={(e) => setNewRights({ ...newRights, [k]: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-fuchsia-600 focus:ring-fuchsia-500" />
                              <span className="text-slate-700 dark:text-slate-200">{RIGHT_LABELS[k]}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="flex justify-end"><button type="submit" disabled={isPending} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg"><UserPlus className="h-4 w-4" /> {isPending ? 'Working...' : 'Add Administrator'}</button></div>
                    </form>
                  </div>
                  <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">Rights are stored in <code>OrganizationMember.permissions</code>. Portal settings are saved server-side in PostgreSQL (<code>Organization.settings</code>); theme remains browser-local.</p>
                </Section>

                <div className="rounded-2xl border border-fuchsia-200/70 bg-gradient-to-r from-fuchsia-500/10 via-violet-500/10 to-cyan-500/10 p-5 dark:border-fuchsia-500/20">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><Zap className="h-5 w-5 text-fuchsia-500" /> Settings persistence</p>
                      <p className="text-sm text-slate-600 dark:text-slate-300">Preferences are stored server-side per organization in PostgreSQL and the currency cookie is synced for dashboards. Payment & Plan subscription/gateways shown above come from live organization data.</p>
                    </div>
                    <button onClick={saveAll} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg"><Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save All Settings'}</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
      <footer className="relative border-t border-slate-200/80 bg-white/60 px-4 py-4 text-center text-sm text-slate-600 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-400">
        Design &amp; Develop by <span className="font-medium text-slate-800 dark:text-slate-200">Wilncom Tech</span>
      </footer>
    </div>
  )
}
