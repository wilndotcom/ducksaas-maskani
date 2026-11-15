import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { syncOrganizationSubscription } from '@/lib/subscription-enforcement'
import { CreditCard, AlertTriangle, Building2, ShieldAlert } from 'lucide-react'

export const instant = false

export default async function MaskaniSuspendedPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')
  const { org: orgParam } = await searchParams

  let orgId: string | null = null
  if (session.user.globalRole === 'super_admin' && orgParam) {
    orgId = orgParam
  } else {
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
      orderBy: { createdAt: 'asc' },
    })
    orgId = membership?.organizationId || null
  }

  const organization = orgId
    ? await prisma.organization.findUnique({
        where: { id: orgId },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          subscriptionEndsAt: true,
          subscriptionPlan: { select: { name: true, currency: true, priceMonthly: true, priceYearly: true } },
          owner: { select: { name: true, email: true } },
        },
      })
    : null

  const gateways = orgId
    ? await prisma.landlordPaymentGateway.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
      })
    : []

  if (organization) {
    await syncOrganizationSubscription(organization.id)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-6 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-rose-600/25 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[28rem] w-[28rem] rounded-full bg-amber-500/20 blur-3xl" />
        <div className="absolute top-1/3 right-1/4 h-72 w-72 rounded-full bg-fuchsia-500/15 blur-3xl" />
      </div>
      <div className="relative w-full max-w-2xl rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-amber-500 shadow-lg">
            <ShieldAlert className="h-7 w-7 text-white" />
          </div>
          <h1 className="mb-2 text-2xl font-bold">Portal suspended</h1>
          <p className="max-w-xl text-slate-300">
            {organization ? <><strong>{organization.name}</strong> is </> : 'This landlord portal is '}
            suspended due to an expired or inactive subscription. Access is disabled until the subscription is renewed and payment is settled.
          </p>
        </div>

        {organization && (
          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4 text-sm">
              <p className="mb-2 flex items-center gap-2 font-semibold text-white"><Building2 className="h-4 w-4 text-amber-300" /> Account</p>
              <p><span className="text-slate-400">Organization:</span> {organization.name}</p>
              <p><span className="text-slate-400">Slug:</span> {organization.slug}</p>
              <p className="capitalize"><span className="text-slate-400">Status:</span> <span className="font-medium text-rose-300">{organization.status.replace('_', ' ')}</span></p>
              <p><span className="text-slate-400">Subscription ends:</span> {organization.subscriptionEndsAt ? organization.subscriptionEndsAt.toISOString().slice(0, 10) : 'Not set'}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4 text-sm">
              <p className="mb-2 flex items-center gap-2 font-semibold text-white"><AlertTriangle className="h-4 w-4 text-rose-300" /> Subscription</p>
              {organization.subscriptionPlan ? (
                <>
                  <p><span className="text-slate-400">Plan:</span> {organization.subscriptionPlan.name}</p>
                  <p><span className="text-slate-400">Monthly:</span> {organization.subscriptionPlan.currency} {organization.subscriptionPlan.priceMonthly}</p>
                  <p><span className="text-slate-400">Yearly:</span> {organization.subscriptionPlan.currency} {organization.subscriptionPlan.priceYearly}</p>
                </>
              ) : (
                <p className="text-slate-300">No subscription plan assigned. Contact DuckSaaS administrator to renew/assign a plan.</p>
              )}
              <p className="mt-2 text-slate-400">Owner: {organization.owner.name} ({organization.owner.email})</p>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-5">
          <div className="mb-3 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-emerald-300" />
            <h2 className="text-lg font-semibold text-white">Payment Gateway</h2>
          </div>
          {gateways.length === 0 ? (
            <div className="text-sm text-slate-200">
              <p>No payment gateway is configured for this organization.</p>
              <p className="mt-1 text-slate-300">Please contact the DuckSaaS administrator/support to arrange subscription renewal and payment.</p>
              <div className="mt-4">
                <a href={`mailto:${organization?.owner.email || ''}?subject=${encodeURIComponent(`Subscription renewal - ${organization?.name || 'Organization'}`)}`} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-2.5 font-semibold text-white shadow-lg shadow-emerald-500/20 hover:opacity-95">
                  <CreditCard className="h-4 w-4" /> Contact for Payment
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-200">Use the configured payment gateway details below to complete renewal/payment, then contact support/admin for reactivation.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {gateways.map((g) => (
                  <div key={g.id} className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="font-semibold capitalize text-white">{g.provider.replace(/_/g, ' ')}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${g.isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-500/20 text-slate-300'}`}>{g.isActive ? 'Active' : 'Inactive'}</span>
                    </div>
                    <p className="text-sm text-slate-300">Account: <span className="font-medium text-white">{g.accountNumber}</span></p>
                  </div>
                ))}
              </div>
              <div className="pt-2">
                <a href={`mailto:${organization?.owner.email || ''}?subject=${encodeURIComponent(`Subscription payment/renewal - ${organization?.name || 'Organization'}`)}`} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-2.5 font-semibold text-white shadow-lg shadow-emerald-500/20 hover:opacity-95">
                  <CreditCard className="h-4 w-4" /> Payment Gateway / Renew
                </a>
              </div>
            </div>
          )}
        </div>

        <p className="mt-5 text-center text-xs text-slate-400">Portal features remain unavailable while suspended. After successful renewal, access will be restored by DuckSaaS.</p>
        <p className="mt-3 text-center text-xs text-slate-500">Design &amp; Develop by <span className="font-medium text-slate-300">Wilncom Tech</span></p>
      </div>
    </div>
  )
}