/**
 * Generic Domain Detection
 * Detects personal/generic email providers (gmail, yahoo, etc.)
 */

export const GENERIC_EMAIL_DOMAINS = [
  // Major providers
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  // Apple
  'icloud.com',
  'me.com',
  'mac.com',
  // Other providers
  'aol.com',
  'protonmail.com',
  'mail.com',
  'yandex.com',
  'zoho.com',
  'gmx.com',
  'fastmail.com',
  // ISP-based
  'comcast.net',
  'verizon.net',
  'att.net',
  'sbcglobal.net',
  'bellsouth.net',
  'cox.net',
  // International
  'qq.com',
  '163.com',
  '126.com',
  'web.de',
  't-online.de',
] as const

export type GenericEmailDomain = (typeof GENERIC_EMAIL_DOMAINS)[number]

export function extractDomainFromEmail(email: string): string | null {
  if (!email || !email.includes('@')) return null
  return email.split('@')[1]?.toLowerCase() || null
}

export function normalizeDomain(domain: string): string {
  return (
    domain
      ?.toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .trim() || ''
  )
}

export function isGenericDomain(domain: string): boolean {
  const normalized = normalizeDomain(domain)
  return GENERIC_EMAIL_DOMAINS.includes(normalized as GenericEmailDomain)
}

export function hasGenericEmailDomain(email: string): boolean {
  const domain = extractDomainFromEmail(email)
  return domain ? isGenericDomain(domain) : false
}

export function isGenericWebsiteDomain(website: string): boolean {
  return isGenericDomain(normalizeDomain(website))
}
