import { getCountries, getCountryCallingCode, isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js'
import type { CountryCode } from 'libphonenumber-js'

export interface CountryPhoneData {
  code: CountryCode
  name: string
  dialCode: string
  flag: string
}

/**
 * Priority country codes shown at the top of country selectors
 */
const PRIORITY_CODES: CountryCode[] = ['US', 'CA', 'GB', 'AU']

/**
 * Convert ISO 3166-1 alpha-2 country code to flag emoji
 */
function countryCodeToFlag(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map(char => String.fromCodePoint(0x1F1E6 + char.charCodeAt(0) - 65))
    .join('')
}

/**
 * Build country phone data from libphonenumber-js metadata + Intl.DisplayNames
 */
function buildCountryData(): { priority: CountryPhoneData[]; others: CountryPhoneData[] } {
  const displayNames = new Intl.DisplayNames(['en'], { type: 'region' })
  const allCodes = getCountries()

  const toData = (code: CountryCode): CountryPhoneData => ({
    code,
    name: displayNames.of(code) || code,
    dialCode: `+${getCountryCallingCode(code)}`,
    flag: countryCodeToFlag(code),
  })

  const priority = PRIORITY_CODES.map(toData)

  const prioritySet = new Set(PRIORITY_CODES)
  const others = allCodes
    .filter(c => !prioritySet.has(c))
    .map(toData)
    .sort((a, b) => a.name.localeCompare(b.name))

  return { priority, others }
}

let _cache: { priority: CountryPhoneData[]; others: CountryPhoneData[] } | null = null

/**
 * Get all countries split into priority (US, CA, GB, AU) and the rest alphabetically
 */
export function getCountryPhoneData() {
  if (!_cache) {
    _cache = buildCountryData()
  }
  return _cache
}

/**
 * Find country data by ISO code
 */
export function getCountryByCode(code: CountryCode): CountryPhoneData | undefined {
  const { priority, others } = getCountryPhoneData()
  return priority.find(c => c.code === code) || others.find(c => c.code === code)
}

/**
 * Validate a phone number for a specific country using libphonenumber
 */
export function validatePhoneNumber(phoneNumber: string, countryCode: CountryCode): boolean {
  if (!phoneNumber.trim()) return true // optional field
  return isValidPhoneNumber(phoneNumber, countryCode)
}

/**
 * Format a phone number to E.164 format (e.g., +14155552671)
 */
export function formatPhoneE164(phoneNumber: string, countryCode: CountryCode): string {
  try {
    const parsed = parsePhoneNumber(phoneNumber, countryCode)
    if (parsed && parsed.isValid()) {
      return parsed.format('E.164')
    }
  } catch {
    // fall through to manual formatting
  }
  const dialCode = `+${getCountryCallingCode(countryCode)}`
  const digits = phoneNumber.replace(/\D/g, '')
  return `${dialCode}${digits}`
}
