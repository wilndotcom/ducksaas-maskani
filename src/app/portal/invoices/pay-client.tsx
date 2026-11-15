'use client'

import { useState, useTransition } from 'react'
import { tenantPayInvoice } from '../actions'
import type { PaymentGatewayProvider } from '@prisma/client'

type Provider = { provider: PaymentGatewayProvider; accountNumber: string; bankName?: string | null; accountName?: string | null; isMpesa: boolean }

export function InvoicesPayClient({ invoiceId, invoiceNumber, balance, providers }: { invoiceId: string; invoiceNumber: string; balance: number; providers: Provider[] }) {
  const [pending, startTransition] = useTransition()
  const [provider, setProvider] = useState<PaymentGatewayProvider>(providers[0]?.provider || 'mpesa_paybill')
  const [phone, setPhone] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selected = providers.find((p) => p.provider === provider)

  function pay() {
    setMsg(null)
    setError(null)
    startTransition(async () => {
      try {
        const result = await tenantPayInvoice({ invoiceId, provider, phone: phone || undefined })
        if (result.authorizationUrl) {
          window.location.href = result.authorizationUrl
          return
        }
        setMsg(result.message)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Payment failed to start')
      }
    })
  }

  return (
    <div className="mt-4 rounded-xl border border-emerald-200/60 bg-emerald-500/10 p-4 dark:border-emerald-500/20">
      <p className="mb-3 text-sm font-medium text-emerald-800 dark:text-emerald-200">Pay {invoiceNumber}</p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Method</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as PaymentGatewayProvider)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900/60 dark:text-white"
          >
            {providers.map((p) => (
              <option key={p.provider} value={p.provider}>
                {p.provider === 'mpesa_paybill' ? 'M-Pesa Paybill' : p.provider === 'mpesa_till' ? 'M-Pesa Till' : p.provider === 'paystack_subaccount' ? 'Card (Paystack)' : 'Bank transfer'}
                {p.accountNumber ? ` · ${p.accountNumber}` : ''}
              </option>
            ))}
          </select>
        </div>
        {selected?.isMpesa && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">M-Pesa phone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07XX XXX XXX"
              className="w-40 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900/60 dark:text-white"
            />
          </div>
        )}
        {selected?.provider === 'bank_transfer' && (
          <div className="w-full rounded-xl border border-sky-200/70 bg-sky-500/10 p-3 text-sm dark:border-sky-500/20">
            <p className="font-semibold text-sky-800 dark:text-sky-200">Pay directly to the landlord&apos;s account</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-slate-700 dark:text-slate-200 sm:grid-cols-4">
              {selected.bankName && <><dt className="text-xs text-slate-500">Bank</dt><dd className="font-medium">{selected.bankName}</dd></>}
              {selected.accountName && <><dt className="text-xs text-slate-500">Account name</dt><dd className="font-medium">{selected.accountName}</dd></>}
              <dt className="text-xs text-slate-500">Account number</dt><dd className="font-medium">{selected.accountNumber}</dd>
              <dt className="text-xs text-slate-500">Reference</dt><dd className="font-medium">{invoiceNumber}</dd>
            </dl>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Use the invoice number as the payment reference. Your landlord will confirm receipt and mark the invoice paid.</p>
          </div>
        )}
        <button
          onClick={pay}
          disabled={pending || (selected?.isMpesa && !phone.trim())}
          className="rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-2 text-sm font-semibold text-white shadow-lg disabled:opacity-60"
        >
          {pending ? 'Starting…' : `Pay ${balance.toLocaleString()}`}
        </button>
      </div>
      {msg && <p className="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">{msg}</p>}
      {error && <p className="mt-3 text-sm font-medium text-rose-600 dark:text-rose-300">{error}</p>}
    </div>
  )
}
