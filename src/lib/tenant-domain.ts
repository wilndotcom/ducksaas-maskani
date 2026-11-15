export function getRootDomain(host?: string | null): string {
  const envRoot = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim()
  if (envRoot) return envRoot.replace(/^https?:\/\//, '').replace(/\/$/, '')

  if (!host) return 'localhost:3000'

  const h = host.toLowerCase()
  // Local/dev hosts - use as-is so subdomains become slug.localhost:3000
  if (h.startsWith('localhost') || h.startsWith('127.0.0.1') || h.startsWith('[::1]')) {
    return host
  }

  // If host already looks like a tenant subdomain of our app domain, strip first label
  const parts = host.split('.')
  if (parts.length > 2) {
    return parts.slice(1).join('.')
  }
  return host
}

export function getTenantHost(slug: string, host?: string | null): string {
  const root = getRootDomain(host)
  const safe = slug || 'your-org'
  return `${safe}.${root}`
}

export function getTenantUrl(slug: string, host?: string | null, protocol?: string): string {
  const tenantHost = getTenantHost(slug, host)
  const root = getRootDomain(host)
  const isLocal = root.startsWith('localhost') || root.startsWith('127.0.0.1') || root.startsWith('[::1]')
  const proto = protocol || (isLocal ? 'http' : 'https')
  return `${proto}://${tenantHost}`
}