'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from '@/components/theme-toggle'
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  TrendingUp,
  Puzzle,
  ScrollText,
  Users,
  Settings,
  LogOut,
  Sparkles,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { useState } from 'react'

const nav = [
  { href: '/ducksaas', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/ducksaas/organizations', label: 'Organizations', icon: Building2 },
  { href: '/ducksaas/plans', label: 'Subscription Plans', icon: CreditCard },
  { href: '/ducksaas/revenue', label: 'Revenue', icon: TrendingUp },
  { href: '/ducksaas/features', label: 'Feature Modules', icon: Puzzle },
  { href: '/ducksaas/users', label: 'Users', icon: Users },
  { href: '/ducksaas/logs', label: 'System Logs', icon: ScrollText },
  { href: '/ducksaas/settings', label: 'Settings', icon: Settings },
]

function NavLinks({
  pathname,
  collapsed,
  onClick,
}: {
  pathname: string
  collapsed: boolean
  onClick?: () => void
}) {
  return (
    <nav className="space-y-1.5">
      {nav.map((item) => {
        const Icon = item.icon
        const active = item.href === '/ducksaas' ? pathname === '/ducksaas' : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClick}
            title={item.label}
            className={`flex items-center rounded-xl py-2.5 text-sm font-medium transition ${
              collapsed ? 'justify-center px-2' : 'gap-3 px-4'
            } ${
              active
                ? 'bg-gradient-to-r from-fuchsia-600 to-cyan-600 text-white shadow-lg shadow-fuchsia-500/20'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        )
      })}
    </nav>
  )
}

export function DucksaasShell({
  children,
  userName,
}: {
  children: React.ReactNode
  userName: string
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const current = nav.find((n) => (n.href === '/ducksaas' ? pathname === '/ducksaas' : pathname.startsWith(n.href)))
  const title = current?.label ?? 'Admin'

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 transition-colors dark:bg-slate-950 dark:text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-fuchsia-400/30 blur-3xl dark:bg-fuchsia-600/20" />
        <div className="absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full bg-cyan-400/30 blur-3xl dark:bg-cyan-500/20" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-violet-400/30 blur-3xl dark:bg-violet-600/20" />
      </div>

      <div className="relative flex min-h-screen">
        <aside
          className={`hidden shrink-0 border-r border-slate-200/80 bg-white/70 backdrop-blur-xl transition-all duration-300 dark:border-white/10 dark:bg-slate-900/60 md:flex md:flex-col ${
            collapsed ? 'w-20 p-3' : 'w-72 p-6'
          }`}
        >
          <div className={`mb-6 flex items-center ${collapsed ? 'justify-center' : 'justify-between gap-3'}`}>
            <Link href="/ducksaas" className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} transition hover:opacity-90`} title="Go to Dashboard">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-cyan-500 shadow-lg shadow-fuchsia-500/30">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              {!collapsed && (
                <div>
                  <h1 className="text-xl font-bold tracking-tight">DuckSaaS</h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Super Admin Portal</p>
                </div>
              )}
            </Link>
            {!collapsed && (
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                title="Minimize menu"
                aria-label="Minimize menu"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white/80 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            )}
          </div>

          {collapsed && (
            <div className="mb-4 flex justify-center">
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                title="Maximize menu"
                aria-label="Maximize menu"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white/80 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="flex-1">
            <NavLinks pathname={pathname} collapsed={collapsed} />
          </div>
          <div className={`mt-6 border-t border-slate-200 pt-6 dark:border-white/10 ${collapsed ? 'flex justify-center' : ''}`}>
            <a
              href="/auth/signout"
              title="Sign Out"
              className={`flex items-center rounded-xl py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50 hover:text-rose-700 dark:text-rose-300 dark:hover:bg-rose-500/10 dark:hover:text-rose-200 ${
                collapsed ? 'justify-center px-2' : 'gap-3 px-4'
              }`}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Sign Out</span>}
            </a>
          </div>
        </aside>

        {open && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
            <aside className="absolute left-0 top-0 flex h-full w-72 flex-col border-r border-slate-200/80 bg-white p-6 dark:border-white/10 dark:bg-slate-900">
              <Link href="/ducksaas" onClick={() => setOpen(false)} className="mb-8 flex items-center gap-3 transition hover:opacity-90" title="Go to Dashboard">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-cyan-500 shadow-lg">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">DuckSaaS</h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Super Admin</p>
                </div>
              </Link>
              <div className="flex-1">
                <NavLinks pathname={pathname} collapsed={false} onClick={() => setOpen(false)} />
              </div>
              <div className="mt-6 border-t border-slate-200 pt-6 dark:border-white/10">
                <a href="/auth/signout" className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-rose-600 dark:text-rose-300">
                  <LogOut className="h-4 w-4" /> Sign Out
                </a>
              </div>
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/60">
            <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 md:hidden dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setCollapsed((c) => !c)}
                  title={collapsed ? 'Maximize menu' : 'Minimize menu'}
                  aria-label={collapsed ? 'Maximize menu' : 'Minimize menu'}
                  className="hidden h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 md:flex dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
                </button>
                <nav className="hidden items-center gap-1 text-sm md:flex">
                  <Link href="/ducksaas" className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white">Admin</Link>
                  <span className="text-slate-300 dark:text-slate-600">/</span>
                  <span className="rounded-lg bg-fuchsia-500/10 px-2 py-1 font-medium text-fuchsia-700 dark:text-fuchsia-300">{title}</span>
                </nav>
                <span className="text-sm font-semibold md:hidden">{title}</span>
              </div>
              <div className="flex items-center gap-3">
                <ThemeToggle />
                <div className="hidden rounded-xl border border-slate-200/80 bg-white/70 px-3 py-1.5 text-sm text-slate-600 sm:block dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                  <span className="font-medium text-slate-900 dark:text-white">{userName}</span>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
          <footer className="border-t border-slate-200/80 bg-white/50 px-4 py-4 text-center text-sm text-slate-600 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-400 sm:px-6 lg:px-8">
            Design &amp; Develop by <span className="font-medium text-slate-800 dark:text-slate-200">Wilncom Tech</span>
          </footer>
        </div>
      </div>
    </div>
  )
}