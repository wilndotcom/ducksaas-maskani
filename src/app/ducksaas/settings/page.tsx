'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getPlatformSettings, savePlatformSettings } from './actions'
import {
  Settings,
  Building2,
  Palette,
  CreditCard,
  Puzzle,
  Wallet,
  Bell,
  Shield,
  Server,
  Database,
  Mail,
  MessageSquare,
  Globe,
  Save,
  CheckCircle2,
  Moon,
  Sun,
  Monitor,
  ExternalLink,
  KeyRound,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const STORAGE_KEY = 'ducksaas_settings'

type ToggleProps = { enabled: boolean; onChange: (v: boolean) => void; label: string; desc?: string }

function Toggle({ enabled, onChange, label, desc }: ToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200/70 bg-white/60 p-4 dark:border-white/10 dark:bg-slate-900/40">
      <div>
        <p className="font-medium text-slate-900 dark:text-white">{label}</p>
        {desc && <p className="text-sm text-slate-500 dark:text-slate-400">{desc}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${
          enabled ? 'bg-gradient-to-r from-fuchsia-500 to-cyan-500' : 'bg-slate-300 dark:bg-slate-600'
        }`}
        aria-pressed={enabled}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${enabled ? 'translate-x-6' : 'translate-x-1'}`}
        />
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

function Section({
  id,
  icon: Icon,
  title,
  desc,
  color,
  children,
}: {
  id: string
  icon: LucideIcon
  title: string
  desc: string
  color: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
      <div className="mb-5 flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-lg ${color}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{desc}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/20 dark:border-white/10 dark:bg-slate-900/60 dark:text-white'

const defaults = {
  general: {
    platformName: 'DuckSaaS & Maskani',
    supportEmail: 'support@ducksaas.com',
    publicUrl: 'http://localhost:3000',
    defaultCurrency: 'USD',
    timezone: 'Africa/Nairobi',
    locale: 'en-US',
  },
  billing: {
    trialDays: 14,
    gracePeriodDays: 7,
    autoSuspend: true,
    invoicePrefix: 'INV',
    taxRate: 0,
    allowYearly: true,
    proration: true,
  },
  features: {
    sms_reminders: true,
    water_submetering: false,
    expense_tracker: true,
    bulk_invoicing: true,
    maintenance_module: true,
    tenant_portal: true,
    online_payments: true,
    reports_analytics: true,
  },
  payments: {
    mpesaEnabled: true,
    mpesaShortcode: '174379',
    mpesaCallback: 'http://localhost:3000/api/payments/mpesa/callback',
    paystackEnabled: true,
    bankTransferEnabled: true,
    cardPayments: false,
  },
  notify: {
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    twilioEnabled: false,
    onNewSignup: true,
    onPaymentReceived: true,
    onSubscriptionExpiring: true,
    onSubscriptionExpired: true,
    onMaintenanceTicket: true,
    weeklyDigest: false,
  },
  security: {
    requireMfa: false,
    sessionTimeoutMins: 60,
    passwordMinLength: 8,
    allowSignups: true,
    enforceStrongPassword: true,
    auditLogging: true,
  },
  system: {
    maintenanceMode: false,
    debugLogs: false,
    apiEnabled: true,
    webhooksEnabled: false,
  },
}

export default function SettingsPage() {
  const [saved, setSaved] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system')

  const [general, setGeneral] = useState(defaults.general)
  const [billing, setBilling] = useState(defaults.billing)
  const [features, setFeatures] = useState(defaults.features)
  const [payments, setPayments] = useState(defaults.payments)
  const [notify, setNotify] = useState(defaults.notify)
  const [security, setSecurity] = useState(defaults.security)
  const [system, setSystem] = useState(defaults.system)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate from storage on mount */
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        if (data.general) setGeneral((p) => ({ ...p, ...data.general }))
        if (data.billing) setBilling((p) => ({ ...p, ...data.billing }))
        if (data.features) setFeatures((p) => ({ ...p, ...data.features }))
        if (data.payments) setPayments((p) => ({ ...p, ...data.payments }))
        if (data.notify) setNotify((p) => ({ ...p, ...data.notify }))
        if (data.security) setSecurity((p) => ({ ...p, ...data.security }))
        if (data.system) setSystem((p) => ({ ...p, ...data.system }))
      }
      const t = localStorage.getItem('theme')
      setTheme(t === 'dark' ? 'dark' : t === 'light' ? 'light' : 'system')
      // Server-side settings win over localStorage so config survives devices/cache clears
      getPlatformSettings().then((server) => {
        if (!server) return
        const apply = (section: unknown, setter: (fn: (p: never) => never) => void) => {
          if (section && typeof section === 'object') setter(((p: Record<string, unknown>) => ({ ...p, ...(section as Record<string, unknown>) })) as never)
        }
        apply(server.general, setGeneral as never)
        apply(server.billing, setBilling as never)
        apply(server.features, setFeatures as never)
        apply(server.payments, setPayments as never)
        apply(server.notify, setNotify as never)
        apply(server.security, setSecurity as never)
        apply(server.system, setSystem as never)
      }).catch(() => {})
    } catch {}
    setLoaded(true)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  const applyTheme = (t: 'light' | 'dark' | 'system') => {
    setTheme(t)
    try {
      if (t === 'system') {
        localStorage.removeItem('theme')
        const d = window.matchMedia('(prefers-color-scheme: dark)').matches
        document.documentElement.classList.toggle('dark', d)
      } else {
        localStorage.setItem('theme', t)
        document.documentElement.classList.toggle('dark', t === 'dark')
      }
    } catch {}
  }

  const flash = (msg: string) => {
    setSaved(msg)
    setTimeout(() => setSaved(null), 2500)
  }

  const persist = async (msg: string) => {
    setSaving(true)
    const payload = { general, billing, features, payments, notify, security, system, updatedAt: new Date().toISOString() }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      await savePlatformSettings(payload)
      document.cookie = `ducksaas_currency=${encodeURIComponent(general.defaultCurrency)}; path=/; max-age=31536000; samesite=lax`
      await new Promise((r) => setTimeout(r, 350))
      flash(msg)
    } catch {
      flash('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const nav = [
    { id: 'general', label: 'General' },
    { id: 'appearance', label: 'Appearance' },
    { id: 'billing', label: 'Billing & Plans' },
    { id: 'features', label: 'Feature Modules' },
    { id: 'payments', label: 'Payment Gateways' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'security', label: 'Security & Access' },
    { id: 'system', label: 'System & Integrations' },
  ]

  if (!loaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-fuchsia-500" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-600 text-white shadow-lg">
              <Settings className="h-5 w-5" />
            </span>
            Platform Settings
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">Manage all DuckSaaS configuration, billing, integrations, and security.</p>
        </div>
        {saved && (
          <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" /> {saved}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        <nav className="shrink-0 lg:sticky lg:top-24 lg:w-56 lg:self-start">
          <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-3 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
            <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Sections</p>
            <div className="flex flex-row flex-wrap gap-1 lg:flex-col">
              {nav.map((n) => (
                <a key={n.id} href={`#${n.id}`} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white">
                  {n.label}
                </a>
              ))}
            </div>
          </div>
        </nav>

        <div className="min-w-0 flex-1 space-y-6">
          <Section id="general" icon={Building2} title="General" desc="Core platform identity and regional defaults." color="bg-gradient-to-br from-cyan-500 to-blue-600">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Platform name"><input className={inputCls} value={general.platformName} onChange={(e) => setGeneral({ ...general, platformName: e.target.value })} /></Field>
              <Field label="Support email"><input className={inputCls} type="email" value={general.supportEmail} onChange={(e) => setGeneral({ ...general, supportEmail: e.target.value })} /></Field>
              <Field label="Public URL"><input className={inputCls} value={general.publicUrl} onChange={(e) => setGeneral({ ...general, publicUrl: e.target.value })} /></Field>
              <Field label="Default currency">
                <select className={inputCls} value={general.defaultCurrency} onChange={(e) => setGeneral({ ...general, defaultCurrency: e.target.value })}>
                  <option>USD</option><option>KES</option><option>EUR</option><option>GBP</option><option>NGN</option>
                </select>
              </Field>
              <Field label="Timezone"><input className={inputCls} value={general.timezone} onChange={(e) => setGeneral({ ...general, timezone: e.target.value })} /></Field>
              <Field label="Locale"><input className={inputCls} value={general.locale} onChange={(e) => setGeneral({ ...general, locale: e.target.value })} /></Field>
            </div>
            <div className="mt-4 flex justify-end"><button onClick={() => persist('General settings saved')} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"><Save className="h-4 w-4" /> Save</button></div>
          </Section>

          <Section id="appearance" icon={Palette} title="Appearance" desc="Theme and visual preferences for the admin portal." color="bg-gradient-to-br from-fuchsia-500 to-pink-600">
            <p className="mb-3 text-sm font-medium text-slate-800 dark:text-slate-200">Theme</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {([
                { v: 'light', label: 'Light', icon: Sun },
                { v: 'dark', label: 'Dark', icon: Moon },
                { v: 'system', label: 'System', icon: Monitor },
              ] as const).map((opt) => {
                const Icon = opt.icon
                const active = theme === opt.v
                return (
                  <button key={opt.v} onClick={() => { applyTheme(opt.v); flash('Appearance updated') }} className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${active ? 'border-fuchsia-500 bg-fuchsia-500/10 ring-1 ring-fuchsia-500/30' : 'border-slate-200 bg-white/60 hover:border-slate-300 dark:border-white/10 dark:bg-slate-900/40 dark:hover:border-white/20'}`}>
                    <Icon className={`h-5 w-5 ${active ? 'text-fuchsia-600 dark:text-fuchsia-300' : 'text-slate-500'}`} />
                    <span className="font-medium text-slate-900 dark:text-white">{opt.label}</span>
                  </button>
                )
              })}
            </div>
          </Section>

          <Section id="billing" icon={CreditCard} title="Billing & Subscription Plans" desc="Trials, grace periods, invoicing, and plan management." color="bg-gradient-to-br from-violet-500 to-purple-600">
            <div className="mb-4 flex flex-wrap gap-2">
              <Link href="/ducksaas/plans" className="inline-flex items-center gap-2 rounded-xl border border-violet-300/50 bg-violet-500/10 px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-500/20 dark:text-violet-300"><ExternalLink className="h-4 w-4" /> Manage Plans</Link>
              <Link href="/ducksaas/revenue" className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/50 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"><ExternalLink className="h-4 w-4" /> Revenue & Ledger</Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Trial period (days)"><input className={inputCls} type="number" value={billing.trialDays} onChange={(e) => setBilling({ ...billing, trialDays: +e.target.value })} /></Field>
              <Field label="Grace period (days)"><input className={inputCls} type="number" value={billing.gracePeriodDays} onChange={(e) => setBilling({ ...billing, gracePeriodDays: +e.target.value })} /></Field>
              <Field label="Invoice prefix"><input className={inputCls} value={billing.invoicePrefix} onChange={(e) => setBilling({ ...billing, invoicePrefix: e.target.value })} /></Field>
              <Field label="Tax/VAT rate (%)"><input className={inputCls} type="number" value={billing.taxRate} onChange={(e) => setBilling({ ...billing, taxRate: +e.target.value })} /></Field>
            </div>
            <div className="mt-4 space-y-3">
              <Toggle enabled={billing.autoSuspend} onChange={(v) => setBilling({ ...billing, autoSuspend: v })} label="Auto-suspend expired organizations" desc="Move orgs to suspended/read-only when subscription ends past grace period." />
              <Toggle enabled={billing.allowYearly} onChange={(v) => setBilling({ ...billing, allowYearly: v })} label="Allow yearly billing cycle" desc="Offer annual pricing on subscription plans." />
              <Toggle enabled={billing.proration} onChange={(v) => setBilling({ ...billing, proration: v })} label="Prorate plan upgrades/downgrades" desc="Calculate charges proportionally when plans change mid-cycle." />
            </div>
            <div className="mt-4 flex justify-end"><button onClick={() => persist('Billing settings saved')} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"><Save className="h-4 w-4" /> Save</button></div>
          </Section>

          <Section id="features" icon={Puzzle} title="Feature Modules" desc="Global feature flags available across plans and tenants." color="bg-gradient-to-br from-amber-500 to-orange-600">
            <div className="mb-4"><Link href="/ducksaas/features" className="inline-flex items-center gap-2 text-sm font-medium text-amber-700 hover:underline dark:text-amber-300"><ExternalLink className="h-4 w-4" /> Open Feature Modules</Link></div>
            <div className="space-y-3">
              <Toggle enabled={features.sms_reminders} onChange={(v) => setFeatures({ ...features, sms_reminders: v })} label="SMS reminders" desc="Send rent and due-date reminders via SMS." />
              <Toggle enabled={features.water_submetering} onChange={(v) => setFeatures({ ...features, water_submetering: v })} label="Water submetering" desc="Track and bill unit-level water usage." />
              <Toggle enabled={features.expense_tracker} onChange={(v) => setFeatures({ ...features, expense_tracker: v })} label="Expense tracker" desc="Record and categorize property expenses." />
              <Toggle enabled={features.bulk_invoicing} onChange={(v) => setFeatures({ ...features, bulk_invoicing: v })} label="Bulk invoicing" desc="Generate invoices for multiple tenants at once." />
              <Toggle enabled={features.maintenance_module} onChange={(v) => setFeatures({ ...features, maintenance_module: v })} label="Maintenance tickets" desc="Tenant maintenance requests and tracking." />
              <Toggle enabled={features.tenant_portal} onChange={(v) => setFeatures({ ...features, tenant_portal: v })} label="Tenant portal" desc="Self-service access for tenants." />
              <Toggle enabled={features.online_payments} onChange={(v) => setFeatures({ ...features, online_payments: v })} label="Online payments" desc="Accept rent via M-Pesa, card, or bank integrations." />
              <Toggle enabled={features.reports_analytics} onChange={(v) => setFeatures({ ...features, reports_analytics: v })} label="Reports & analytics" desc="Dashboards and exportable reports." />
            </div>
            <div className="mt-4 flex justify-end"><button onClick={() => persist('Feature modules saved')} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"><Save className="h-4 w-4" /> Save</button></div>
          </Section>

          <Section id="payments" icon={Wallet} title="Payment Gateways" desc="Configure platform and landlord payment collection channels." color="bg-gradient-to-br from-emerald-500 to-teal-600">
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200/70 bg-white/60 p-4 dark:border-white/10 dark:bg-slate-900/40">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-white"><SmartphoneIcon /> M-Pesa (Daraja)</div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${payments.mpesaEnabled ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>{payments.mpesaEnabled ? 'Enabled' : 'Disabled'}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Shortcode"><input className={inputCls} value={payments.mpesaShortcode} onChange={(e) => setPayments({ ...payments, mpesaShortcode: e.target.value })} /></Field>
                  <Field label="Callback URL"><input className={inputCls} value={payments.mpesaCallback} onChange={(e) => setPayments({ ...payments, mpesaCallback: e.target.value })} /></Field>
                </div>
                <p className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"><KeyRound className="h-3.5 w-3.5" /> Consumer key/secret/passkey managed via environment variables.</p>
                <div className="mt-3"><Toggle enabled={payments.mpesaEnabled} onChange={(v) => setPayments({ ...payments, mpesaEnabled: v })} label="Enable M-Pesa" /></div>
              </div>
              <div className="rounded-xl border border-slate-200/70 bg-white/60 p-4 dark:border-white/10 dark:bg-slate-900/40">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-medium text-slate-900 dark:text-white">Paystack</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${payments.paystackEnabled ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>{payments.paystackEnabled ? 'Enabled' : 'Disabled'}</span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Secret/public keys configured via environment variables (masked).</p>
                <div className="mt-3"><Toggle enabled={payments.paystackEnabled} onChange={(v) => setPayments({ ...payments, paystackEnabled: v })} label="Enable Paystack" /></div>
              </div>
              <Toggle enabled={payments.bankTransferEnabled} onChange={(v) => setPayments({ ...payments, bankTransferEnabled: v })} label="Bank transfer" desc="Allow manual bank transfer recording and instructions." />
              <Toggle enabled={payments.cardPayments} onChange={(v) => setPayments({ ...payments, cardPayments: v })} label="Card payments" desc="Accept card payments where supported by gateway." />
            </div>
            <div className="mt-4 flex justify-end"><button onClick={() => persist('Payment gateway settings saved')} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"><Save className="h-4 w-4" /> Save</button></div>
          </Section>

          <Section id="notifications" icon={Bell} title="Notifications" desc="Email, SMS, and platform alert preferences." color="bg-gradient-to-br from-sky-500 to-indigo-600">
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-3 flex items-center gap-2 font-medium text-slate-900 dark:text-white"><Mail className="h-4 w-4" /> Email (SMTP)</p>
                <div className="space-y-3">
                  <Field label="SMTP host"><input className={inputCls} value={notify.smtpHost} onChange={(e) => setNotify({ ...notify, smtpHost: e.target.value })} placeholder="smtp.example.com" /></Field>
                  <Field label="SMTP port"><input className={inputCls} value={notify.smtpPort} onChange={(e) => setNotify({ ...notify, smtpPort: e.target.value })} /></Field>
                  <Field label="SMTP user"><input className={inputCls} value={notify.smtpUser} onChange={(e) => setNotify({ ...notify, smtpUser: e.target.value })} /></Field>
                  <p className="text-xs text-slate-500 dark:text-slate-400">SMTP password stored via environment variable.</p>
                </div>
              </div>
              <div>
                <p className="mb-3 flex items-center gap-2 font-medium text-slate-900 dark:text-white"><MessageSquare className="h-4 w-4" /> SMS (Twilio)</p>
                <Toggle enabled={notify.twilioEnabled} onChange={(v) => setNotify({ ...notify, twilioEnabled: v })} label="Enable SMS notifications" desc="Twilio credentials configured via environment variables." />
                <p className="mt-4 mb-2 text-sm font-medium text-slate-800 dark:text-slate-200">Alert preferences</p>
                <div className="space-y-3">
                  <Toggle enabled={notify.onNewSignup} onChange={(v) => setNotify({ ...notify, onNewSignup: v })} label="New organization signup" />
                  <Toggle enabled={notify.onPaymentReceived} onChange={(v) => setNotify({ ...notify, onPaymentReceived: v })} label="Payment received" />
                  <Toggle enabled={notify.onSubscriptionExpiring} onChange={(v) => setNotify({ ...notify, onSubscriptionExpiring: v })} label="Subscription expiring soon" />
                  <Toggle enabled={notify.onSubscriptionExpired} onChange={(v) => setNotify({ ...notify, onSubscriptionExpired: v })} label="Subscription expired" />
                  <Toggle enabled={notify.onMaintenanceTicket} onChange={(v) => setNotify({ ...notify, onMaintenanceTicket: v })} label="New maintenance ticket" />
                  <Toggle enabled={notify.weeklyDigest} onChange={(v) => setNotify({ ...notify, weeklyDigest: v })} label="Weekly platform digest" />
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end"><button onClick={() => persist('Notification settings saved')} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"><Save className="h-4 w-4" /> Save</button></div>
          </Section>

          <Section id="security" icon={Shield} title="Security & Access" desc="Authentication, sessions, and platform access controls." color="bg-gradient-to-br from-rose-500 to-red-600">
            <div className="mb-4 grid gap-4 sm:grid-cols-2">
              <Field label="Session timeout (minutes)"><input className={inputCls} type="number" value={security.sessionTimeoutMins} onChange={(e) => setSecurity({ ...security, sessionTimeoutMins: +e.target.value })} /></Field>
              <Field label="Minimum password length"><input className={inputCls} type="number" value={security.passwordMinLength} onChange={(e) => setSecurity({ ...security, passwordMinLength: +e.target.value })} /></Field>
            </div>
            <div className="space-y-3">
              <Toggle enabled={security.requireMfa} onChange={(v) => setSecurity({ ...security, requireMfa: v })} label="Require MFA for admins" desc="Enforce multi-factor authentication for super admin accounts." />
              <Toggle enabled={security.enforceStrongPassword} onChange={(v) => setSecurity({ ...security, enforceStrongPassword: v })} label="Enforce strong passwords" desc="Require mixed case, numbers, and symbols." />
              <Toggle enabled={security.allowSignups} onChange={(v) => setSecurity({ ...security, allowSignups: v })} label="Allow new landlord signups" desc="Permit self-service organization registration." />
              <Toggle enabled={security.auditLogging} onChange={(v) => setSecurity({ ...security, auditLogging: v })} label="Audit logging" desc="Record administrative actions and sensitive changes." />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/ducksaas/logs" className="inline-flex items-center gap-2 rounded-xl border border-slate-300/60 bg-white/60 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-200"><ExternalLink className="h-4 w-4" /> View System Logs</Link>
            </div>
            <div className="mt-4 flex justify-end"><button onClick={() => persist('Security settings saved')} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"><Save className="h-4 w-4" /> Save</button></div>
          </Section>

          <Section id="system" icon={Server} title="System & Integrations" desc="Infrastructure connections, APIs, and maintenance controls." color="bg-gradient-to-br from-slate-600 to-slate-800">
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-xl border border-slate-200/70 bg-white/60 p-4 dark:border-white/10 dark:bg-slate-900/40">
                <Database className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
                <div><p className="font-medium text-slate-900 dark:text-white">PostgreSQL</p><p className="text-xs text-slate-500 dark:text-slate-400">Connected Â· localhost:5432 / ducksaas_maskani</p></div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-slate-200/70 bg-white/60 p-4 dark:border-white/10 dark:bg-slate-900/40">
                <Server className="h-5 w-5 text-rose-500" />
                <div><p className="font-medium text-slate-900 dark:text-white">Redis</p><p className="text-xs text-slate-500 dark:text-slate-400">Configured Â· localhost:6379</p></div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-slate-200/70 bg-white/60 p-4 dark:border-white/10 dark:bg-slate-900/40">
                <Globe className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                <div><p className="font-medium text-slate-900 dark:text-white">NextAuth</p><p className="text-xs text-slate-500 dark:text-slate-400">Credentials provider Â· JWT sessions</p></div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-slate-200/70 bg-white/60 p-4 dark:border-white/10 dark:bg-slate-900/40">
                <KeyRound className="h-5 w-5 text-violet-600 dark:text-violet-300" />
                <div><p className="font-medium text-slate-900 dark:text-white">Secrets</p><p className="text-xs text-slate-500 dark:text-slate-400">Managed via environment variables (.env)</p></div>
              </div>
            </div>
            <div className="space-y-3">
              <Toggle enabled={system.apiEnabled} onChange={(v) => setSystem({ ...system, apiEnabled: v })} label="Platform API access" desc="Enable API endpoints for integrations." />
              <Toggle enabled={system.webhooksEnabled} onChange={(v) => setSystem({ ...system, webhooksEnabled: v })} label="Webhooks" desc="Send event notifications to external endpoints." />
              <Toggle enabled={system.debugLogs} onChange={(v) => setSystem({ ...system, debugLogs: v })} label="Verbose debug logging" desc="Increase log detail for troubleshooting (disable in production)." />
              <div className="rounded-xl border border-amber-300/50 bg-amber-500/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-300" />
                  <div className="flex-1">
                    <p className="font-medium text-amber-900 dark:text-amber-100">Maintenance mode</p>
                    <p className="text-sm text-amber-800/80 dark:text-amber-200/80">Temporarily restrict access for upgrades. Admin access remains available.</p>
                    <div className="mt-3"><Toggle enabled={system.maintenanceMode} onChange={(v) => setSystem({ ...system, maintenanceMode: v })} label="Enable maintenance mode" /></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end"><button onClick={() => persist('System settings saved')} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"><Save className="h-4 w-4" /> Save</button></div>
          </Section>
        </div>
      </div>
    </div>
  )
}

function SmartphoneIcon() {
  return (
    <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
  )
}
