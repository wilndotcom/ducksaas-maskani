import Link from 'next/link'
import { Sparkles } from 'lucide-react'

export type MobileNavItem = { href: string; label: string; active?: boolean }

/** Horizontal navigation bar shown on small screens where the sidebar is hidden. */
export function MobileNav({ items, title, signOutHref = '/auth/signout' }: { items: MobileNavItem[]; title?: string; signOutHref?: string }) {
  return (
    <div className="sticky top-0 z-40 -mx-6 mb-6 border-b border-slate-200/80 bg-slate-100/90 px-4 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/90 lg:-mx-10 lg:px-10 md:hidden">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500"><Sparkles className="h-4 w-4 text-white" /></div>
        {title && <span className="truncate text-sm font-bold">{title}</span>}
      </div>
      <nav className="flex gap-2 overflow-x-auto pb-1">
        {items.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${n.active ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white/70 text-slate-600 hover:bg-white dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20'}`}
          >
            {n.label}
          </Link>
        ))}
        <a href={signOutHref} className="shrink-0 rounded-full bg-rose-500/15 px-3.5 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-300">Sign Out</a>
      </nav>
    </div>
  )
}
