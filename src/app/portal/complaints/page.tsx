import { resolveTenantContext } from '@/lib/portal'
import { prisma } from '@/lib/prisma'
import { MessageSquareWarning } from 'lucide-react'
import { ComplaintsClient } from './complaints-client'

export const instant = false

export default async function PortalComplaints() {
  const { session, org } = await resolveTenantContext()

  const complaints = await prisma.complaint.findMany({
    where: { organizationId: org.id, tenantUserId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return (
    <div>
      <div className="mb-8">
        <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-rose-400/40 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-700 dark:text-rose-200"><MessageSquareWarning className="h-3.5 w-3.5" /> Complaints</p>
        <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">Complaints</h2>
        <p className="mt-1 text-slate-600 dark:text-slate-400">Raise issues with management and track resolution</p>
      </div>
      <ComplaintsClient complaints={complaints.map((c) => ({
        id: c.id,
        subject: c.subject,
        description: c.description,
        status: c.status,
        priority: c.priority,
        resolutionNote: c.resolutionNote,
        createdAt: c.createdAt.toISOString(),
      }))} />
    </div>
  )
}


