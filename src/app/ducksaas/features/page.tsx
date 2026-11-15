import { Puzzle, CheckCircle2, XCircle, Building2, Info } from 'lucide-react'
import { prisma } from '@/lib/prisma'

export const instant = false

const MODULE_CATALOG: { key: string; name: string; description: string; category: string }[] = [
  { key: 'sms_reminders', name: 'SMS Reminders', description: 'Send rent and due-date reminders to tenants via SMS.', category: 'Communication' },
  { key: 'water_submetering', name: 'Water Submetering', description: 'Track and bill unit-level water usage.', category: 'Billing' },
  { key: 'expense_tracker', name: 'Expense Tracker', description: 'Record and categorize property expenses.', category: 'Finance' },
  { key: 'bulk_invoicing', name: 'Bulk Invoicing', description: 'Generate invoices for multiple tenants at once.', category: 'Billing' },
  { key: 'maintenance_module', name: 'Maintenance Tickets', description: 'Tenant maintenance requests and tracking workflow.', category: 'Operations' },
  { key: 'tenant_portal', name: 'Tenant Portal', description: 'Self-service access for tenants to view leases and payments.', category: 'Experience' },
  { key: 'online_payments', name: 'Online Payments', description: 'Accept rent via M-Pesa, card, or bank integrations.', category: 'Payments' },
  { key: 'reports_analytics', name: 'Reports & Analytics', description: 'Dashboards and exportable performance reports.', category: 'Insights' },
]

export default async function FeaturesPage() {
  const plans = await prisma.subscriptionPlan.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, isActive: true, featureFlags: true, _count: { select: { organizations: true } } },
  })

  const moduleUsage = MODULE_CATALOG.map((m) => {
    const enabledIn = plans.filter((p) => {
      const flags = (p.featureFlags as Record<string, unknown>) || {}
      return flags[m.key] === true
    })
    return { ...m, enabledPlanCount: enabledIn.length, enabledPlanNames: enabledIn.map((p) => p.name) }
  })

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <h1 className="flex items-center gap-3 text-3xl font-bold">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg"><Puzzle className="h-5 w-5" /></span>
          Feature Modules
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">Platform capabilities and how subscription plans enable them.</p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-5 dark:border-white/10 dark:bg-white/5"><p className="text-sm text-slate-500 dark:text-slate-400">Modules Cataloged</p><p className="mt-1 text-2xl font-bold">{MODULE_CATALOG.length}</p></div>
        <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-5 dark:border-white/10 dark:bg-white/5"><p className="text-sm text-slate-500 dark:text-slate-400">Subscription Plans</p><p className="mt-1 text-2xl font-bold">{plans.length}</p></div>
        <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-5 dark:border-white/10 dark:bg-white/5"><p className="text-sm text-slate-500 dark:text-slate-400">Active Plans</p><p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-300">{plans.filter((p) => p.isActive).length}</p></div>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white/70 p-6 dark:border-white/10 dark:bg-white/5">
        <h2 className="mb-4 text-lg font-semibold">Module Catalog</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {moduleUsage.map((m) => (
            <div key={m.key} className="rounded-xl border border-slate-200/70 bg-white/60 p-4 dark:border-white/10 dark:bg-slate-900/40">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">{m.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{m.category} · key: <code>{m.key}</code></p>
                </div>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${m.enabledPlanCount > 0 ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-slate-500/15 text-slate-600 dark:text-slate-300'}`}>
                  {m.enabledPlanCount > 0 ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />} {m.enabledPlanCount}/{plans.length || 0} plans
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">{m.description}</p>
              {m.enabledPlanNames.length > 0 && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Enabled in: {m.enabledPlanNames.join(', ')}</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 dark:border-white/10 dark:bg-white/5">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Building2 className="h-5 w-5" /> Plan Feature Matrix</h2>
        {plans.length === 0 ? (
          <div className="flex items-start gap-2 rounded-xl border border-amber-300/40 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
            <Info className="mt-0.5 h-4 w-4 shrink-0" /> No subscription plans found. Feature flags are configured per plan in <code>SubscriptionPlan.featureFlags</code>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/10 text-slate-500">
                  <th className="py-2 pr-3">Plan</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Orgs</th>
                  {MODULE_CATALOG.map((m) => <th key={m.key} className="py-2 px-2 text-center whitespace-nowrap" title={m.name}>{m.name.split(' ').map(w => w[0]).join('')}</th>)}
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => {
                  const flags = (p.featureFlags as Record<string, unknown>) || {}
                  return (
                    <tr key={p.id} className="border-b border-slate-100 dark:border-white/5">
                      <td className="py-2 pr-3 font-medium">{p.name}</td>
                      <td className="py-2 pr-3">{p.isActive ? 'Active' : 'Inactive'}</td>
                      <td className="py-2 pr-3">{p._count.organizations}</td>
                      {MODULE_CATALOG.map((m) => (
                        <td key={m.key} className="py-2 px-2 text-center">{flags[m.key] ? <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <XCircle className="mx-auto h-4 w-4 text-slate-300 dark:text-slate-600" />}</td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
