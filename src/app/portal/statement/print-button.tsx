'use client'

import { Printer } from 'lucide-react'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg dark:bg-white dark:text-slate-900"
    >
      <Printer className="h-4 w-4" /> Print / Save as PDF
    </button>
  )
}
