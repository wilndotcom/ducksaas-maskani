/**
 * Reads organization billing settings regardless of shape:
 * the settings UI saves nested camelCase ({ billing: { invoicePrefix } }),
 * while older code read flat snake_case ({ invoice_prefix }).
 */
export function orgBillingSettings(settings: unknown) {
  const s = (settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {}) as Record<string, unknown>
  const b = (s.billing && typeof s.billing === 'object' && !Array.isArray(s.billing) ? s.billing : {}) as Record<string, unknown>
  const g = (s.general && typeof s.general === 'object' && !Array.isArray(s.general) ? s.general : {}) as Record<string, unknown>
  const num = (...vals: unknown[]) => {
    for (const v of vals) {
      const n = Number(v)
      if (Number.isFinite(n)) return n
    }
    return 0
  }
  return {
    invoicePrefix: String(b.invoicePrefix ?? s.invoice_prefix ?? 'INV').replace(/[^A-Za-z0-9-]/g, '').slice(0, 10) || 'INV',
    graceDays: Math.max(0, Math.min(60, num(b.graceDays, s.payment_grace_days))),
    lateFeeEnabled: b.lateFeeEnabled !== false && s.late_fee_enabled !== false,
    lateFeeType: String(b.lateFeeType ?? s.late_fee_type ?? 'fixed'),
    lateFeeValue: num(b.lateFeeValue, s.late_fee_amount, s.late_fee_value),
    partialPayments: b.allowPartialPayments !== false && s.partial_payments !== false,
    autoMarkOverdue: b.autoMarkOverdue !== false,
    currency: String(g.currency ?? s.currency ?? 'KES'),
  }
}
