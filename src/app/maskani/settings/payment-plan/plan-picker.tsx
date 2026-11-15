'use client'

import { useState, useTransition } from 'react'
import { subscribeToPlan } from '../actions'
import { CreditCard, Smartphone } from 'lucide-react'

type Plan = {
  id: string
  name: string
  pricingModel: string
  priceMonthly: number
  priceYearly: number
  pricePerPropertyMonthly: number
  pricePerPropertyYearly: number
  includedProperties: number
  currency: string
  maxUnits: number
}

function fmt(n: number, currency: string) {
  return `${currency} ${n.toLocaleString()}`
}

export function PlanPicker({ orgId, plans, currentPlanId, propertyCount }: { orgId: string; plans: Plan[]; currentPlanId: string | null; propertyCount: number }) {
  const [pending, startTransition] = useTransition()
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [phone, setPhone] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (plans.length === 0) return null

  function priceFor(plan: Plan) {
    if (plan.pricingModel === 'per_property') {
      const base = cycle === 'yearly' ? plan.priceYearly : plan.priceMonthly
      const per = cycle === 'yearly' ? plan.pricePerPropertyYearly : plan.pricePerPropertyMonthly
      const extra = Math.max(0, propertyCount - plan.includedProperties)
      return base + extra * per
    }
    return cycle === 'yearly' ? plan.priceYearly : plan.priceMonthly
  }

  function subscribe(planId: string) {
    setMsg(null)
    setError(null)
    startTransition(async () => {
      try {
        const result = await subscribeToPlan({ orgId, planId, billingCycle: cycle, phone: phone || undefined })
        if (result.authorizationUrl) {
          window.location.href = result.authorizationUrl
          return
        }
        setMsg(result.message)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Payment failed to start')
      }
    })
  }

  return (
    <div className="rounded-xl border border-fuchsia-200/60 bg-fuchsia-500/5 p-4 dark:border-fuchsia-500/20">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Choose a plan & billing cycle</p>
        <div className="flex rounded-xl border border-slate-200 bg-white p-1 text-xs font-medium dark:border-white/10 dark:bg-slate-900/60">
          {(['monthly', 'yearly'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              className={`rounded-lg px-3 py-1.5 capitalize transition ${cycle === c ? 'bg-fuchsia-600 text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-3">
        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">M-Pesa phone (for STK push payments)</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="07XX XXX XXX"
          className="w-48 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900/60 dark:text-white"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId
          return (
            <div key={plan.id} className={`rounded-xl border p-4 ${isCurrent ? 'border-emerald-300 bg-emerald-500/10 dark:border-emerald-500/30' : 'border-slate-200 bg-white/70 dark:border-white/10 dark:bg-slate-900/40'}`}>
              <div className="mb-2 flex items-center justify-between">
                <p className="font-semibold text-slate-900 dark:text-white">{plan.name}</p>
                {isCurrent && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">CURRENT</span>}
              </div>
              <p className="text-lg font-bold text-fuchsia-700 dark:text-fuchsia-300">{fmt(priceFor(plan), plan.currency)}<span className="text-xs font-normal text-slate-500">/{cycle === 'yearly' ? 'yr' : 'mo'}</span></p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {plan.pricingModel === 'per_property'
                  ? `${plan.includedProperties} properties incl. · +${fmt(plan.pricePerPropertyMonthly, plan.currency)}/property/mo`
                  : 'Flat rate · all properties'}
                {' · '}up to {plan.maxUnits} units
              </p>
              <button
                onClick={() => subscribe(plan.id)}
                disabled={pending || isCurrent}
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-3 py-2 text-sm font-semibold text-white shadow disabled:opacity-50"
              >
                <CreditCard className="h-4 w-4" /> {isCurrent ? 'Current plan' : pending ? 'Processing…' : `Pay ${cycle}`}
              </button>
            </div>
          )
        })}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><Smartphone className="h-3.5 w-3.5" /> Pay securely by M-Pesa (enter phone above) or card. Your subscription activates automatically on payment confirmation.</p>
      {msg && <p className="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">{msg}</p>}
      {error && <p className="mt-2 text-sm font-medium text-rose-600 dark:text-rose-300">{error}</p>}
    </div>
  )
}
