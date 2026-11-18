'use client'

import { useRouter } from 'next/navigation'
import { Building2 } from 'lucide-react'

export function PortalOrgSwitcher({ orgs, activeId }: { orgs: { id: string; name: string }[]; activeId: string }) {
  const router = useRouter()
  if (orgs.length <= 1) return null
  return (
    <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5">
      <Building2 className="h-4 w-4 text-emerald-500" />
      <select
        value={activeId}
        onChange={(e) => {
          document.cookie = `maskani_org=${e.target.value}; path=/; max-age=31536000; samesite=lax`
          router.refresh()
        }}
        className="bg-transparent font-medium text-slate-700 outline-none dark:text-slate-200"
      >
        {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </div>
  )
}
