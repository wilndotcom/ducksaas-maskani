'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
  XCircle,
  Building2,
  Layers,
  Calculator,
  Wallet,
  Building,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { calculatePlanAmount, describePricing, type PlanPricing } from '@/lib/saas-billing'
import { createSubscriptionPlan, updateSubscriptionPlan, deleteSubscriptionPlan, toggleSubscriptionPlan } from './actions'

type Plan = PlanPricing & {
  id: string
  name: string
  currency: string
  maxUnits: number
  featureFlags: unknown
  isActive: boolean
  _count: { organizations: number; saasSubscriptions: number }
}

const KNOWN_FEATURES: { key: string; label: string; hint: string }[] = [
  { key: 'sms_reminders', label: 'SMS reminders', hint: 'Rent and due-date reminders via SMS' },
  { key: 'water_submetering', label: 'Water submetering', hint: 'Unit-level water usage and billing' },
  { key: 'expense_tracker', label: 'Expense tracker', hint: 'Record and categorize property expenses' },
  { key: 'bulk_invoicing', label: 'Bulk invoicing', hint: 'Generate invoices for many tenants at once' },
  { key: 'maintenance_module', label: 'Maintenance tickets', hint: 'Tenant requests and tracking workflow' },
  { key: 'tenant_portal', label: 'Tenant portal', hint: 'Self-service access for tenants' },
  { key: 'online_payments', label: 'Online payments', hint: 'Collect rent via M-Pesa, card, or bank' },
  { key: 'reports_analytics', label: 'Reports & analytics', hint: 'Dashboards and exportable reports' },
]

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 dark:border-white/10 dark:bg-slate-900/60 dark:text-white'
const labelCls = 'mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200'
const hintCls = 'mt-1 text-xs text-slate-500 dark:text-slate-400'

function toNum(v: string, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function FeatureSwitch({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${
        checked
          ? 'border-emerald-300/60 bg-emerald-500/10 dark:border-emerald-500/30'
          : 'border-slate-200 bg-white/60 hover:border-slate-300 dark:border-white/10 dark:bg-slate-900/40 dark:hover:border-white/20'
      }`}
    >
      <div>
        <p className="text-sm font-medium text-slate-900 dark:text-white">{label}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      </div>
      {checked ? <ToggleRight className="h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" /> : <ToggleLeft className="h-6 w-6 shrink-0 text-slate-400" />}
    </button>
  )
}

function PlanForm({
  initial,
  onClose,
  currency,
}: {
  initial?: Plan | null
  onClose: () => void
  currency: string
}) {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const [model, setModel] = useState<'flat' | 'per_property'>(initial?.pricingModel === 'per_property' ? 'per_property' : 'flat')
  const [name, setName] = useState(initial?.name || '')
  const [planCurrency, setPlanCurrency] = useState(initial?.currency || 'USD')
  const [maxUnits, setMaxUnits] = useState(String(initial?.maxUnits ?? 10))
  const [isActive, setIsActive] = useState(initial ? initial.isActive : true)
  const initMonthly = initial?.priceMonthly ?? 1500
  const initYearly = initial?.priceYearly ?? initMonthly * 12
  const initPerMonthly = initial?.pricePerPropertyMonthly ?? 500
  const initPerYearly = initial?.pricePerPropertyYearly ?? initPerMonthly * 12
  const [priceMonthly, setPriceMonthly] = useState(String(initMonthly))
  const [priceYearly, setPriceYearly] = useState(String(initYearly))
  const [yearlyEdited, setYearlyEdited] = useState(() => !!initial && Math.abs((initial.priceYearly ?? 0) - (initial.priceMonthly ?? 0) * 12) > 0.001)
  const [includedProperties, setIncludedProperties] = useState(String(initial?.includedProperties ?? 1))
  const [pricePerPropertyMonthly, setPricePerPropertyMonthly] = useState(String(initPerMonthly))
  const [pricePerPropertyYearly, setPricePerPropertyYearly] = useState(String(initPerYearly))
  const [perYearlyEdited, setPerYearlyEdited] = useState(() => !!initial && Math.abs((initial.pricePerPropertyYearly ?? 0) - (initial.pricePerPropertyMonthly ?? 0) * 12) > 0.001)
  const [advanced, setAdvanced] = useState(false)

  const autoYearly = (monthly: string) => {
    const n = toNum(monthly, NaN)
    return Number.isFinite(n) ? String(Number((n * 12).toFixed(2))) : ''
  }

  const onMonthlyChange = (v: string) => {
    setPriceMonthly(v)
    if (!yearlyEdited) setPriceYearly(autoYearly(v))
  }
  const onYearlyChange = (v: string) => {
    setPriceYearly(v)
    setYearlyEdited(true)
  }
  const onPerMonthlyChange = (v: string) => {
    setPricePerPropertyMonthly(v)
    if (!perYearlyEdited) setPricePerPropertyYearly(autoYearly(v))
  }
  const onPerYearlyChange = (v: string) => {
    setPricePerPropertyYearly(v)
    setPerYearlyEdited(true)
  }

  const initialFlags = (initial?.featureFlags && typeof initial.featureFlags === 'object' && !Array.isArray(initial.featureFlags) ? (initial.featureFlags as Record<string, unknown>) : {}) || {}
  const [flags, setFlags] = useState<Record<string, boolean>>(() => {
    const f: Record<string, boolean> = {}
    for (const k of KNOWN_FEATURES) f[k.key] = initialFlags[k.key] === true
    return f
  })
  const [customFlags, setCustomFlags] = useState(() => {
    const extra: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(initialFlags)) {
      if (!KNOWN_FEATURES.find((x) => x.key === k)) extra[k] = v
    }
    return Object.keys(extra).length ? JSON.stringify(extra, null, 2) : '{}'
  })

  const pricing: PlanPricing = useMemo(
    () => ({
      pricingModel: model,
      priceMonthly: toNum(priceMonthly, 0),
      priceYearly: toNum(priceYearly, 0),
      includedProperties: Math.max(0, Math.floor(toNum(includedProperties, 0))),
      pricePerPropertyMonthly: toNum(pricePerPropertyMonthly, 0),
      pricePerPropertyYearly: toNum(pricePerPropertyYearly, 0),
    }),
    [model, priceMonthly, priceYearly, includedProperties, pricePerPropertyMonthly, pricePerPropertyYearly],
  )

  const preview = useMemo(
    () => ({
      m1: calculatePlanAmount(pricing, 1, 'monthly'),
      m3: calculatePlanAmount(pricing, 3, 'monthly'),
      m10: calculatePlanAmount(pricing, 10, 'monthly'),
      y1: calculatePlanAmount(pricing, 1, 'yearly'),
    }),
    [pricing],
  )

  const submit = (fd: FormData) => {
    let merged: Record<string, unknown> = { ...flags }
    try {
      const extra = JSON.parse(customFlags || '{}')
      if (extra && typeof extra === 'object' && !Array.isArray(extra)) merged = { ...merged, ...extra }
    } catch {
      setMsg('Advanced feature flags must be valid JSON.')
      return
    }
    fd.set('featureFlags', JSON.stringify(merged))
    fd.set('pricingModel', model)
    if (isActive) fd.set('isActive', 'on')
    else fd.delete('isActive')
    startTransition(async () => {
      try {
        if (initial) await updateSubscriptionPlan(fd)
        else await createSubscriptionPlan(fd)
        onClose()
      } catch (e) {
        setMsg(e instanceof Error ? e.message : 'Failed to save plan')
      }
    })
  }

  return (
    <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between border-b border-slate-200/70 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 px-6 py-4 dark:border-white/10">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{initial ? 'Edit Subscription Plan' : 'Create Subscription Plan'}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">Set how landlords are billed on DuckSaaS (fixed or per property).</p>
        </div>
        <button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-white/70 dark:hover:bg-white/10"><X className="h-5 w-5" /></button>
      </div>

      {msg && <div className="mx-6 mt-4 rounded-xl bg-rose-500/10 px-4 py-2 text-sm text-rose-700 dark:text-rose-300">{msg}</div>}

      <form action={submit} className="space-y-6 p-6">
        {initial && <input type="hidden" name="id" value={initial.id} />}

        <section>
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100"><Sparkles className="h-4 w-4 text-violet-500" /> Basics</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <label className={labelCls}>Plan name *</label>
              <input name="name" required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. Starter, Growth, Enterprise" />
              <p className={hintCls}>Shown to admins when assigning plans to organizations.</p>
            </div>
            <div>
              <label className={labelCls}>Plan currency code</label>
              <input name="currency" value={planCurrency} onChange={(e) => setPlanCurrency(e.target.value.toUpperCase())} className={inputCls} placeholder="USD" maxLength={10} />
              <p className={hintCls}>Stored as metadata (display uses saved currency: {currency}).</p>
            </div>
            <div>
              <label className={labelCls}>Max units (limit)</label>
              <input name="maxUnits" type="number" min={0} step={1} value={maxUnits} onChange={(e) => setMaxUnits(e.target.value)} className={inputCls} />
              <p className={hintCls}>Plan capacity/limit reference.</p>
            </div>
          </div>
          <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white/60 px-4 py-2.5 text-sm font-medium dark:border-white/10 dark:bg-slate-900/40">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-violet-600" />
            Active plan (available for assignment)
          </label>
        </section>

        <section>
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100"><CreditCard className="h-4 w-4 text-violet-500" /> Pricing model</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setModel('flat')}
              className={`rounded-2xl border p-4 text-left transition ${model === 'flat' ? 'border-violet-500 bg-violet-500/10 ring-1 ring-violet-500/30' : 'border-slate-200 bg-white/60 hover:border-slate-300 dark:border-white/10 dark:bg-slate-900/40 dark:hover:border-white/20'}`}
            >
              <div className="mb-2 flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><Wallet className="h-5 w-5 text-violet-600 dark:text-violet-300" /> Fixed price</div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Charge one flat amount for the landlord, no matter how many properties they add (subject to plan limits).</p>
              <p className="mt-2 text-xs font-medium text-violet-700 dark:text-violet-300">Example: {formatCurrency(1500, currency)}/month for all properties</p>
            </button>
            <button
              type="button"
              onClick={() => setModel('per_property')}
              className={`rounded-2xl border p-4 text-left transition ${model === 'per_property' ? 'border-cyan-500 bg-cyan-500/10 ring-1 ring-cyan-500/30' : 'border-slate-200 bg-white/60 hover:border-slate-300 dark:border-white/10 dark:bg-slate-900/40 dark:hover:border-white/20'}`}
            >
              <div className="mb-2 flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><Building className="h-5 w-5 text-cyan-600 dark:text-cyan-300" /> Per property</div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Base price (with included properties) plus a fee for each additional property. Revenue scales as landlords grow.</p>
              <p className="mt-2 text-xs font-medium text-cyan-700 dark:text-cyan-300">Example: base {formatCurrency(500, currency)} + {formatCurrency(400, currency)}/extra property</p>
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-5 dark:border-white/10 dark:bg-slate-900/30">
          <p className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-100">{model === 'flat' ? 'Fixed pricing' : 'Base + per-property pricing'}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className={labelCls}>{model === 'flat' ? 'Monthly price *' : 'Base monthly price *'}</label>
              <input name="priceMonthly" type="number" min={0} step="0.01" required value={priceMonthly} onChange={(e) => onMonthlyChange(e.target.value)} className={inputCls} />
              <p className={hintCls}>{model === 'flat' ? 'Charged every month.' : 'Charged every month (covers included properties).'}</p>
            </div>
            <div>
              <label className={labelCls}>{model === 'flat' ? 'Yearly price *' : 'Base yearly price *'}</label>
              <input name="priceYearly" type="number" min={0} step="0.01" required value={priceYearly} onChange={(e) => onYearlyChange(e.target.value)} className={inputCls} />
              <p className={hintCls}>Auto-fills as monthly × 12 (you can override for a yearly discount).</p>
            </div>
            {model === 'per_property' && (
              <>
                <div>
                  <label className={labelCls}>Properties included in base</label>
                  <input name="includedProperties" type="number" min={0} step={1} value={includedProperties} onChange={(e) => setIncludedProperties(e.target.value)} className={inputCls} />
                  <p className={hintCls}>No extra fee for these.</p>
                </div>
                <div>
                  <label className={labelCls}>Extra property fee (monthly)</label>
                  <input name="pricePerPropertyMonthly" type="number" min={0} step="0.01" value={pricePerPropertyMonthly} onChange={(e) => onPerMonthlyChange(e.target.value)} className={inputCls} />
                  <p className={hintCls}>Per property above included count.</p>
                </div>
                <div>
                  <label className={labelCls}>Extra property fee (yearly)</label>
                  <input name="pricePerPropertyYearly" type="number" min={0} step="0.01" value={pricePerPropertyYearly} onChange={(e) => onPerYearlyChange(e.target.value)} className={inputCls} />
                  <p className={hintCls}>Auto-fills as monthly × 12 (you can override).</p>
                </div>
              </>
            )}
          </div>

          <div className="mt-5 rounded-xl border border-violet-200/60 bg-white/70 p-4 dark:border-violet-500/20 dark:bg-slate-950/30">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100"><Calculator className="h-4 w-4 text-violet-500" /> Live pricing preview (saved currency: {currency})</p>
            <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-slate-100/80 p-3 dark:bg-white/5"><p className="text-xs text-slate-500 dark:text-slate-400">1 property / month</p><p className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(preview.m1.amount, currency)}</p></div>
              <div className="rounded-lg bg-slate-100/80 p-3 dark:bg-white/5"><p className="text-xs text-slate-500 dark:text-slate-400">3 properties / month</p><p className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(preview.m3.amount, currency)}</p></div>
              <div className="rounded-lg bg-slate-100/80 p-3 dark:bg-white/5"><p className="text-xs text-slate-500 dark:text-slate-400">10 properties / month</p><p className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(preview.m10.amount, currency)}</p></div>
              <div className="rounded-lg bg-slate-100/80 p-3 dark:bg-white/5"><p className="text-xs text-slate-500 dark:text-slate-400">1 property / year</p><p className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(preview.y1.amount, currency)}</p></div>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{describePricing(pricing)} Charges are calculated in DuckSaaS from the organization’s property count at plan assignment/renewal.</p>
          </div>
        </section>

        <section>
          <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Included features</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {KNOWN_FEATURES.map((f) => (
              <FeatureSwitch key={f.key} label={f.label} hint={f.hint} checked={!!flags[f.key]} onChange={(v) => setFlags((p) => ({ ...p, [f.key]: v }))} />
            ))}
          </div>
          <button type="button" onClick={() => setAdvanced((a) => !a)} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-violet-700 hover:underline dark:text-violet-300">
            {advanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />} Advanced: custom feature flags (JSON)
          </button>
          {advanced && (
            <div className="mt-2">
              <textarea value={customFlags} onChange={(e) => setCustomFlags(e.target.value)} rows={4} className={`${inputCls} font-mono text-xs`} spellCheck={false} placeholder='{"custom_flag": true}' />
              <p className={hintCls}>Optional extra flags merged with the toggles above (must be a JSON object).</p>
            </div>
          )}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 pt-4 dark:border-white/10">
          <p className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><Info className="h-3.5 w-3.5" /> SaaS billing only (not applied to Maskani tenant/landlord operations).</p>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">Cancel</button>
            <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2 text-sm font-semibold text-white shadow-lg disabled:opacity-60">
              {pending ? 'Saving...' : initial ? 'Save changes' : 'Create plan'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

export function PlansManager({ plans, totalOrgs, currency }: { plans: Plan[]; totalOrgs: number; currency: string }) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Plan | null>(null)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ text: string; type: 'ok' | 'error' } | null>(null)
  const activePlans = useMemo(() => plans.filter((p) => p.isActive).length, [plans])

  const flash = (text: string, type: 'ok' | 'error' = 'ok') => {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3500)
  }
  const run = (fn: () => Promise<void>, ok: string) =>
    startTransition(async () => {
      try {
        await fn()
        flash(ok, 'ok')
      } catch (e) {
        flash(e instanceof Error ? e.message : 'Action failed', 'error')
      }
    })

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg"><CreditCard className="h-5 w-5" /></span>
            Subscription Plans
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">Professional SaaS pricing for landlords — choose fixed or per-property billing.</p>
        </div>
        <div className="flex items-center gap-3">
          {msg && <div className={`rounded-xl px-4 py-2 text-sm font-medium ${msg.type === 'error' ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'}`}>{msg.text}</div>}
          <button onClick={() => { setEditing(null); setShowForm(true) }} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 hover:opacity-95"><Plus className="h-4 w-4" /> Add Plan</button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-5 dark:border-white/10 dark:bg-white/5"><p className="text-sm text-slate-500 dark:text-slate-400">Total Plans</p><p className="mt-1 text-2xl font-bold">{plans.length}</p></div>
        <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-5 dark:border-white/10 dark:bg-white/5"><p className="text-sm text-slate-500 dark:text-slate-400">Active Plans</p><p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-300">{activePlans}</p></div>
        <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-5 dark:border-white/10 dark:bg-white/5"><p className="text-sm text-slate-500 dark:text-slate-400">Organizations</p><p className="mt-1 text-2xl font-bold">{totalOrgs}</p></div>
      </div>

      {(showForm || editing) && <PlanForm initial={editing} currency={currency} onClose={() => { setShowForm(false); setEditing(null) }} />}

      {plans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-12 text-center dark:border-white/15 dark:bg-white/5">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-600 dark:text-violet-300"><CreditCard className="h-7 w-7" /></div>
          <p className="text-lg font-semibold text-slate-900 dark:text-white">No subscription plans yet</p>
          <p className="mt-2 text-slate-600 dark:text-slate-400">Create your first SaaS plan: fixed price for all properties, or base + per additional property.</p>
          <button onClick={() => { setEditing(null); setShowForm(true) }} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Create plan</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {plans.map((plan) => {
            const flags = (plan.featureFlags as Record<string, unknown>) || {}
            const flagEntries = Object.entries(flags).filter(([, v]) => v === true)
            const model = plan.pricingModel === 'per_property' ? 'per_property' : 'flat'
            const ex1 = calculatePlanAmount(plan, 1, 'monthly')
            const ex3 = calculatePlanAmount(plan, 3, 'monthly')
            const ex10 = calculatePlanAmount(plan, 10, 'monthly')
            return (
              <div key={plan.id} className="group rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-white/5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{plan.name}</h2>
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${model === 'flat' ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300' : 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'}`}>{model === 'flat' ? 'Fixed price' : 'Per property'}</span>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Max units: {plan.maxUnits} · Plan currency: {plan.currency}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${plan.isActive ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-slate-500/15 text-slate-700 dark:text-slate-300'}`}>
                    {plan.isActive ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />} {plan.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="mb-4 rounded-xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 p-4 dark:from-violet-500/15 dark:to-fuchsia-500/15">
                  {model === 'flat' ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div><p className="text-xs text-slate-500 dark:text-slate-400">Monthly</p><p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(plan.priceMonthly, currency)}</p><p className="text-xs text-slate-500">all properties</p></div>
                      <div><p className="text-xs text-slate-500 dark:text-slate-400">Yearly</p><p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(plan.priceYearly, currency)}</p><p className="text-xs text-slate-500">all properties</p></div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div><p className="text-xs text-slate-500 dark:text-slate-400">Base monthly</p><p className="text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(plan.priceMonthly, currency)}</p></div>
                        <div><p className="text-xs text-slate-500 dark:text-slate-400">Base yearly</p><p className="text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(plan.priceYearly, currency)}</p></div>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300">Includes <strong>{plan.includedProperties}</strong> {plan.includedProperties === 1 ? 'property' : 'properties'} · +{formatCurrency(plan.pricePerPropertyMonthly, currency)}/mo or +{formatCurrency(plan.pricePerPropertyYearly, currency)}/yr per extra property</p>
                    </div>
                  )}
                </div>

                <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">{describePricing(plan)}</p>

                <div className="mb-4 rounded-xl border border-slate-200/70 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-slate-900/40">
                  <p className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-200"><Calculator className="h-3.5 w-3.5" /> Estimated monthly charge</p>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-white/70 p-2 dark:bg-white/5"><p className="text-slate-500 dark:text-slate-400">1 property</p><p className="font-semibold text-slate-900 dark:text-white">{formatCurrency(ex1.amount, currency)}</p></div>
                    <div className="rounded-lg bg-white/70 p-2 dark:bg-white/5"><p className="text-slate-500 dark:text-slate-400">3 properties</p><p className="font-semibold text-slate-900 dark:text-white">{formatCurrency(ex3.amount, currency)}</p></div>
                    <div className="rounded-lg bg-white/70 p-2 dark:bg-white/5"><p className="text-slate-500 dark:text-slate-400">10 properties</p><p className="font-semibold text-slate-900 dark:text-white">{formatCurrency(ex10.amount, currency)}</p></div>
                  </div>
                </div>

                <div className="mb-4 flex flex-wrap gap-2 text-sm">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 dark:bg-white/5"><Building2 className="h-4 w-4 text-slate-500" /> {plan._count.organizations} orgs</span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 dark:bg-white/5"><Layers className="h-4 w-4 text-slate-500" /> {plan._count.saasSubscriptions} ledger</span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 dark:bg-white/5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> {flagEntries.length} features</span>
                </div>

                {flagEntries.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-1.5">
                    {flagEntries.slice(0, 6).map(([k]) => (
                      <span key={k} className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">{k.replace(/_/g, ' ')}</span>
                    ))}
                    {flagEntries.length > 6 && <span className="rounded-full bg-slate-500/10 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">+{flagEntries.length - 6} more</span>}
                  </div>
                )}

                <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200/70 pt-4 dark:border-white/10">
                  {(() => {
                    const assigned = plan._count.organizations > 0
                    const hasLedger = plan._count.saasSubscriptions > 0
                    const canDelete = !assigned
                    const deleteTitle = assigned
                      ? 'Cannot delete: assigned to organizations. Unassign first.'
                      : hasLedger
                        ? `Delete plan and remove ${plan._count.saasSubscriptions} billing/ledger record(s)`
                        : 'Delete plan'
                    const deleteMsg = hasLedger
                      ? `Delete plan "${plan.name}"? This will also permanently remove ${plan._count.saasSubscriptions} billing/ledger record(s) and affect revenue history.`
                      : `Delete plan "${plan.name}"? This cannot be undone.`
                    return (
                      <>
                        <button onClick={() => { const fd = new FormData(); fd.set('id', plan.id); run(() => toggleSubscriptionPlan(fd), plan.isActive ? 'Plan deactivated' : 'Plan activated') }} disabled={pending} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/5">{plan.isActive ? 'Deactivate' : 'Activate'}</button>
                        <button onClick={() => { setEditing(plan); setShowForm(false) }} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"><Pencil className="h-4 w-4" /> Edit</button>
                        <button
                          onClick={() => { if (!canDelete) { flash('Cannot delete: plan is assigned to organizations. Unassign it first.', 'error'); return } if (!confirm(deleteMsg)) return; const fd = new FormData(); fd.set('id', plan.id); run(() => deleteSubscriptionPlan(fd), hasLedger ? 'Plan and ledger records deleted' : 'Plan deleted') }}
                          disabled={pending || !canDelete}
                          title={deleteTitle}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
                        ><Trash2 className="h-4 w-4" /> Delete</button>
                      </>
                    )
                  })()}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
