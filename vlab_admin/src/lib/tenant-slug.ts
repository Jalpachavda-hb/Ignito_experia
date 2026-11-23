const STORAGE_KEY = 'tenant-slug'
const RESERVED = new Set(['www', 'localhost', 'experia', 'api', 'owner'])

/**
 * Platform apex domains. University portals live on {slug}.{apex}.
 * VITE_BASE_DOMAIN is the live apex (default ignitoexperia.com); VITE_LEGACY_BASE_DOMAINS
 * (comma separated) keeps older apexes working (default experia.ignitolearn.com).
 */
const cleanDomain = (value: string) =>
  value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '')

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env || {}
const BASE_DOMAIN = cleanDomain(env.VITE_BASE_DOMAIN || '') || 'ignitoexperia.com'
const LEGACY_DOMAINS = String(env.VITE_LEGACY_BASE_DOMAINS ?? 'experia.ignitolearn.com')
  .split(',')
  .map(cleanDomain)
  .filter((d) => d && d !== BASE_DOMAIN)
export const PLATFORM_DOMAINS = [BASE_DOMAIN, ...LEGACY_DOMAINS]

function isIpHost(hostname: string) {
  if (hostname.includes(':')) return true
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)
}

function platformApexFor(hostname: string) {
  return PLATFORM_DOMAINS.find((apex) => hostname === apex || hostname.endsWith(`.${apex}`)) || ''
}

/** True on the main site itself (apex or www.apex), where no university slug applies. */
export function isPlatformMainHost(host: string) {
  const hostname = host.split(':')[0].trim().toLowerCase()
  return PLATFORM_DOMAINS.some((apex) => hostname === apex || hostname === `www.${apex}`)
}

export function slugFromHost(host: string) {
  const hostname = host.split(':')[0].trim().toLowerCase()
  if (
    !hostname ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    isIpHost(hostname) ||
    isPlatformMainHost(hostname)
  ) {
    return ''
  }
  const parts = hostname.split('.')
  // {slug}.{platform apex}: only the label directly in front of the apex is a slug.
  const apex = platformApexFor(hostname)
  if (apex) {
    const prefix = hostname.slice(0, -(apex.length + 1))
    if (!prefix || prefix.includes('.')) return ''
    return RESERVED.has(prefix) ? '' : prefix
  }
  // {slug}.localhost during development.
  if (hostname.endsWith('.localhost') && parts.length === 2) {
    return RESERVED.has(parts[0]) ? '' : parts[0]
  }
  // Other hosts: a bare two-label domain (example.com) is an apex, never a slug.
  if (parts.length > 2 && !RESERVED.has(parts[0])) return parts[0]
  return ''
}

/** Query `?slug=` wins. A raw IP has no hostname slug, so the last slug in this tab is kept. */
export function getTenantSlug() {
  if (typeof window === 'undefined') return ''

  const fromQuery = (new URLSearchParams(window.location.search).get('slug') || '')
    .trim()
    .toLowerCase()
  if (fromQuery && /^[a-z0-9][a-z0-9-]{0,62}$/.test(fromQuery)) {
    sessionStorage.setItem(STORAGE_KEY, fromQuery)
    return fromQuery
  }

  // On the main platform domain without ?slug this is direct Experia (no university).
  if (isPlatformMainHost(window.location.hostname)) {
    sessionStorage.removeItem(STORAGE_KEY)
    return ''
  }

  const fromHost = slugFromHost(window.location.hostname)
  if (fromHost) {
    sessionStorage.setItem(STORAGE_KEY, fromHost)
    return fromHost
  }

  return sessionStorage.getItem(STORAGE_KEY) || ''
}
