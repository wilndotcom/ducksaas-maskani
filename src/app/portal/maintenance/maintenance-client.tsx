'use client'

import { useState, useTransition } from 'react'
import { tenantCreateTicket } from '../actions'
import { Plus, X } from 'lucide-react'

type Ticket = { id: string; title: string; category: string; priority: string; status: string; description: string | null; createdAt: string }

const statusStyles: Record<string, string> = {
  open: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  in_progress: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  resolved: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
}

export function MaintenanceClient({ tickets }: { tickets: Ticket[] }) {
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-slate-900/60 dark:text-white'

  function submit(fd: FormData) {
    setMsg(null)
    startTransition(async () => {
      try {
        await tenantCreateTicket(fd)
        setMsg('Request submitted')
        setOpen(false)
      } catch (e) {
        setMsg(e instanceof Error ? e.message : 'Failed to submit')
      }
    })
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        {msg && <div className="rounded-xl bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">{msg}</div>}
        <button onClick={() => setOpen(true)} className="ml-auto inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg"><Plus className="h-4 w-4" /> New Request</button>
      </div>

      {open && (
        <form action={submit} className="mb-8 rounded-2xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">New Maintenance Request</h3><button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"><X className="h-4 w-4" /></button></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="mb-1 block text-sm font-medium">Title *</label><input name="title" required className={inputCls} placeholder="e.g. Kitchen sink leaking" /></div>
            <div><label className="mb-1 block text-sm font-medium">Category *</label><select name="category" required className={inputCls}><option value="plumbing">Plumbing</option><option value="electrical">Electrical</option><option value="structural">Structural</option><option value="other">Other</option></select></div>
            <div><label className="mb-1 block text-sm font-medium">Priority</label><select name="priority" defaultValue="medium" className={inputCls}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
            <div className="sm:col-span-2"><label className="mb-1 block text-sm font-medium">Description</label><textarea name="description" rows={3} className={inputCls} placeholder="Describe the issue…" /></div>
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">Cancel</button>
            <button type="submit" disabled={pending} className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-slate-900">{pending ? 'Submitting…' : 'Submit Request'}</button>
          </div>
        </form>
      )}

      {tickets.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-10 text-center text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">No maintenance requests yet.</div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <div key={t.id} className="rounded-2xl border border-slate-200/80 bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{t.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{t.category} · {t.priority} priority · {new Date(t.createdAt).toLocaleDateString()}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusStyles[t.status] || statusStyles.open}`}>{t.status.replace('_', ' ')}</span>
              </div>
              {t.description && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{t.description}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
