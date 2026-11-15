export function formatCurrency(amount: number, currency: string = 'USD') {
  const safe = Number.isFinite(amount) ? amount : 0
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 2,
    }).format(safe)
  } catch {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(safe)
  }
}

export function getSavedCurrency(cookieValue?: string | null) {
  const c = String(cookieValue || '').trim().toUpperCase()
  return c || 'USD'
}