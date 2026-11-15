export function StatusBadge({ status, dueDate }: { status: string; dueDate?: Date | string | null }) {
  const effective = status === 'unpaid' && dueDate && new Date(dueDate) < new Date() ? 'overdue' : status
  const styles: Record<string, string> = {
    paid: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    partial: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
    unpaid: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
    overdue: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  }
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${styles[effective] || styles.unpaid}`}>{effective}</span>
}
