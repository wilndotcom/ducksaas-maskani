'use client'

import { useState, useTransition } from 'react'
import { Save, KeyRound } from 'lucide-react'
import { updatePortalProfile, changePortalPassword } from './actions'

const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-slate-900/60 dark:text-white'

export function PortalProfileForms({ userName, userPhone }: { userName: string; userPhone: string }) {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3000) }

  return (
    <form action={(fd) => startTransition(async () => {
      try { await updatePortalProfile(fd); flash('Profile updated') } catch (e) { flash(e instanceof Error ? e.message : 'Failed') }
    })} className="space-y-3">
      <div>
        <label className="mb-1 block text-sm font-medium">Full name</label>
        <input name="name" required defaultValue={userName} className={inputCls} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Phone</label>
        <input name="phone" defaultValue={userPhone} className={inputCls} placeholder="+254 7XX XXX XXX" />
      </div>
      {msg && <p className="text-sm text-emerald-600 dark:text-emerald-300">{msg}</p>}
      <button disabled={pending} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
        <Save className="h-4 w-4" /> {pending ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  )
}

export function PortalPasswordForm() {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [resetKey, setResetKey] = useState(0)

  return (
    <form key={resetKey} action={(fd) => startTransition(async () => {
      try { await changePortalPassword(fd); setMsg({ ok: true, text: 'Password changed' }); setResetKey((k) => k + 1) }
      catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Failed' }) }
    })} className="space-y-3">
      <div>
        <label className="mb-1 block text-sm font-medium">Current password</label>
        <input name="currentPassword" type="password" required className={inputCls} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">New password</label>
        <input name="newPassword" type="password" required minLength={8} className={inputCls} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Confirm new password</label>
        <input name="confirmPassword" type="password" required minLength={8} className={inputCls} />
      </div>
      {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>{msg.text}</p>}
      <button disabled={pending} className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
        <KeyRound className="h-4 w-4" /> {pending ? 'Updating…' : 'Change password'}
      </button>
    </form>
  )
}
