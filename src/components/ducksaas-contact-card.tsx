import { Mail, Phone, MessageSquare, Globe } from 'lucide-react'

type Contact = {
  label: string
  value: string
  href?: string
  icon: React.ComponentType<{ className?: string }>
}

export function DucksaasContactCard({
  title = 'Platform Contacts',
  description = 'Reach the DuckSaaS team for support, billing, or escalations.',
}: {
  title?: string
  description?: string
}) {
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@ducksaas.com'
  const billingEmail = process.env.NEXT_PUBLIC_BILLING_EMAIL || 'billing@ducksaas.com'
  const supportPhone = process.env.NEXT_PUBLIC_SUPPORT_PHONE || '+254 700 000 000'
  const whatsapp = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || supportPhone
  const site = process.env.NEXT_PUBLIC_PLATFORM_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'

  const contacts: Contact[] = [
    { label: 'Support Email', value: supportEmail, href: `mailto:${supportEmail}`, icon: Mail },
    { label: 'Billing Email', value: billingEmail, href: `mailto:${billingEmail}`, icon: Mail },
    { label: 'Support Phone', value: supportPhone, href: `tel:${supportPhone.replace(/[^+\d]/g, '')}`, icon: Phone },
    { label: 'WhatsApp', value: whatsapp, href: `https://wa.me/${whatsapp.replace(/[^+\d]/g, '').replace(/^\+/, '')}`, icon: MessageSquare },
    { label: 'Platform URL', value: site, href: site, icon: Globe },
  ]

  return (
    <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{description}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {contacts.map((c) => {
          const Icon = c.icon
          const inner = (
            <div className="flex items-start gap-3 rounded-xl border border-slate-200/70 bg-white/60 p-4 transition hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-slate-900/40 dark:hover:border-white/20">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900/5 text-slate-700 dark:bg-white/10 dark:text-slate-200">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{c.label}</p>
                <p className="truncate text-sm font-medium text-slate-900 dark:text-white" title={c.value}>{c.value}</p>
              </div>
            </div>
          )
          return c.href ? (
            <a key={c.label} href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined} rel={c.href.startsWith('http') ? 'noreferrer' : undefined}>
              {inner}
            </a>
          ) : (
            <div key={c.label}>{inner}</div>
          )
        })}
      </div>
    </div>
  )
}
