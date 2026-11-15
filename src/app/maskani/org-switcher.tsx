'use client'

import { useTransition } from 'react'
import { setActiveOrganization } from './org-actions'
import { Building2 } from 'lucide-react'

export function OrgSwitcher({ orgs, currentOrgId }: { orgs: { id: string; name: string }[]; currentOrgId: string }) {
  const [pending, startTransition] = useTransition()
  if (orgs.length < 2) return null

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-slate-400" />
      <select
        value={currentOrgId}
        disabled={pending}
        onChange={(e) => startTransition(() => setActiveOrganization(e.target.value))}
        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 outline-none transition focus:border-emerald-400 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200"
      >
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    </div>
  )
}
