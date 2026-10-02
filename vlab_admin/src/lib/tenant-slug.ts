const STORAGE_KEY = 'tenant-slug'
const RESERVED = new Set(['www', 'localhost', 'experia'])

function isIpHost(hostname: string) {
  if (hostname.includes(':')) return true
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)
}

export function slugFromHost(host: string) {
  const hostname = host.split(':')[0].trim().toLowerCase()
  if (
    !hostname ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    isIpHost(hostname) ||
    hostname === 'experia.ignitolearn.com' ||
    hostname === 'www.experia.ignitolearn.com'
  ) {
    return ''
  }
  const parts = hostname.split('.')
  if (parts.length > 1 && !RESERVED.has(parts[0])) return parts[0]
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

  const hostname = window.location.hostname.toLowerCase()
  // If explicitly on the direct Experia apex domain without ?slug, this is direct Experia
  if (hostname === 'experia.ignitolearn.com' || hostname === 'www.experia.ignitolearn.com') {
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
