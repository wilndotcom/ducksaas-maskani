import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Users, ShieldCheck, UserPlus, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { createPlatformUser, setUserRole } from './actions'

export const instant = false

export default async function UsersPage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.globalRole !== 'super_admin') redirect('/')

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true, name: true, email: true, username: true, globalRole: true, createdAt: true,
      _count: { select: { organizationMembers: true, ownedOrganizations: true } },
    },
  })

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/ducksaas" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
      <div className="mb-8">
        <h1 className="flex items-center gap-3 text-3xl font-bold">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg"><Users className="h-5 w-5" /></span>
          Users
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">All accounts on the platform — promote landlords/tenants or grant admin access.</p>
      </div>

      <div className="mb-8 rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold"><UserPlus className="h-5 w-5 text-emerald-500" /> Create account</h2>
        <form action={createPlatformUser} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input name="name" required placeholder="Full name" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-900/60" />
          <input name="email" type="email" required placeholder="Email" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-900/60" />
          <input name="password" type="password" required minLength={8} placeholder="Password (min 8)" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-900/60" />
          <select name="role" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-900/60">
            <option value="standard">Standard user</option>
            <option value="super_admin">Super admin</option>
          </select>
          <button className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">Create</button>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-white/10 dark:text-slate-400">
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Username</th>
                <th className="px-5 py-3">Orgs</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Joined</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 dark:border-white/5">
                  <td className="px-5 py-3">
                    <p className="font-medium">{u.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{u.email}</p>
                  </td>
                  <td className="px-5 py-3 text-slate-500">{u.username || '—'}</td>
                  <td className="px-5 py-3">{u._count.organizationMembers + u._count.ownedOrganizations}</td>
                  <td className="px-5 py-3">
                    {u.globalRole === 'super_admin' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2.5 py-1 text-xs font-semibold text-violet-700 dark:text-violet-300"><ShieldCheck className="h-3 w-3" /> Admin</span>
                    ) : (
                      <span className="rounded-full bg-slate-500/10 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300">User</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-500">{u.createdAt.toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-right">
                    <form action={setUserRole} className="inline">
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="role" value={u.globalRole === 'super_admin' ? 'standard' : 'super_admin'} />
                      <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">
                        {u.globalRole === 'super_admin' ? 'Remove admin' : 'Make admin'}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
