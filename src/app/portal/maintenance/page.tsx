import { resolveTenantContext } from '@/lib/portal'
import { prisma } from '@/lib/prisma'
import { Wrench } from 'lucide-react'
import { MaintenanceClient } from './maintenance-client'

export const instant = false

export default async function PortalMaintenance() {
  const { session, org } = await resolveTenantContext()

  const tickets = await prisma.maintenanceTicket.findMany({
    where: { organizationId: org.id, tenantUserId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return (
    <div>
      <div className="mb-8">
        <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-200"><Wrench className="h-3.5 w-3.5" /> Maintenance</p>
        <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">Maintenance Requests</h2>
        <p className="mt-1 text-slate-600 dark:text-slate-400">Report issues in your unit and track their status</p>
      </div>
      <MaintenanceClient tickets={tickets.map((t) => ({
        id: t.id,
        title: t.title,
        category: t.category,
        priority: t.priority,
        status: t.status,
        description: t.description,
        createdAt: t.createdAt.toISOString(),
      }))} />
    </div>
  )
}


