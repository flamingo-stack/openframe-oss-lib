import { getCountries, getCountryCallingCode, isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js';
import type { CountryCode } from 'libphonenumber-js';

export interface CountryPhoneData {
  code: CountryCode;
  name: string;
  dialCode: string;
  flag: string;
}

/**
 * Priority country codes shown at the top of country selectors
 */
const PRIORITY_CODES: CountryCode[] = ['US', 'CA', 'GB', 'AU'];

/**
 * Common country name aliases mapped to ISO country codes
 * Handles variations like "USA", "United States of America", "UK", etc.
 */
const COUNTRY_NAME_ALIASES: Record<string, CountryCode> = {
  // United States
  usa: 'US',
  'u.s.a.': 'US',
  'u.s.a': 'US',
  'u.s.': 'US',
  us: 'US',
  'united states of america': 'US',
  america: 'US',
  'the united states': 'US',
  'the usa': 'US',

  // United Kingdom
  uk: 'GB',
  'u.k.': 'GB',
  'u.k': 'GB',
  britain: 'GB',
  'great britain': 'GB',
  england: 'GB',
  scotland: 'GB',
  wales: 'GB',
  'northern ireland': 'GB',

  // Canada
  can: 'CA',

  // Australia
  aus: 'AU',
  aussie: 'AU',

  // Germany
  deutschland: 'DE',
  'west germany': 'DE',

  // France
  'république française': 'FR',

  // Spain
  españa: 'ES',

  // Italy
  italia: 'IT',

  // Netherlands
  holland: 'NL',
  'the netherlands': 'NL',

  // Russia
  'russian federation': 'RU',
  russia: 'RU',

  // China
  prc: 'CN',
  "people's republic of china": 'CN',
  'mainland china': 'CN',

  // South Korea
  korea: 'KR',
  'south korea': 'KR',
  'republic of korea': 'KR',

  // North Korea
  'north korea': 'KP',
  dprk: 'KP',

  // Taiwan
  'republic of china': 'TW',
  roc: 'TW',

  // UAE
  uae: 'AE',
  'u.a.e.': 'AE',
  emirates: 'AE',

  // New Zealand
  nz: 'NZ',
  aotearoa: 'NZ',

  // Czech Republic
  'czech republic': 'CZ',
  czechia: 'CZ',

  // Slovakia
  'slovak republic': 'SK',

  // Switzerland
  swiss: 'CH',
  schweiz: 'CH',
  suisse: 'CH',

  // Brazil
  brasil: 'BR',

  // Mexico
  méxico: 'MX',

  // Japan
  nippon: 'JP',
  nihon: 'JP',

  // India
  bharat: 'IN',

  // South Africa
  rsa: 'ZA',
  'south africa': 'ZA',

  // Israel
  israeli: 'IL',

  // Ukraine
  ukraina: 'UA',

  // Poland
  polska: 'PL',

  // Vietnam
  'viet nam': 'VN',

  // Philippines
  'the philippines': 'PH',

  // Singapore
  sg: 'SG',

  // Hong Kong
  hk: 'HK',
  'hong kong sar': 'HK',

  // Ireland
  eire: 'IE',
  éire: 'IE',
  'republic of ireland': 'IE',
};

/**
 * Convert ISO 3166-1 alpha-2 country code to flag emoji
 */
function countryCodeToFlag(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map(char => String.fromCodePoint(0x1f1e6 + char.charCodeAt(0) - 65))
    .join('');
}

/**
 * Build country phone data from libphonenumber-js metadata + Intl.DisplayNames
 */
function buildCountryData(): { priority: CountryPhoneData[]; others: CountryPhoneData[] } {
  const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
  const allCodes = getCountries();

  const toData = (code: CountryCode): CountryPhoneData => ({
    code,
    name: displayNames.of(code) || code,
    dialCode: `+${getCountryCallingCode(code)}`,
    flag: countryCodeToFlag(code),
  });

  const priority = PRIORITY_CODES.map(toData);

  const prioritySet = new Set(PRIORITY_CODES);
  const others = allCodes
    .filter(c => !prioritySet.has(c))
    .map(toData)
    .sort((a, b) => a.name.localeCompare(b.name));

  return { priority, others };
}

let _cache: { priority: CountryPhoneData[]; others: CountryPhoneData[] } | null = null;

/**
 * Get all countries split into priority (US, CA, GB, AU) and the rest alphabetically
 */
export function getCountryPhoneData() {
  if (!_cache) {
    _cache = buildCountryData();
  }
  return _cache;
}

/**
 * Find country data by ISO code
 */
export function getCountryByCode(code: CountryCode): CountryPhoneData | undefined {
  const { priority, others } = getCountryPhoneData();
  return priority.find(c => c.code === code) || others.find(c => c.code === code);
}

/**
 * Find country data by name (case-insensitive)
 * Handles common aliases like "USA", "UK", "America", etc.
 * Useful for converting country names to flags
 */
export function getCountryByName(name: string): CountryPhoneData | undefined {
  if (!name) return undefined;
  const normalizedName = name.toLowerCase().trim();

  // Check aliases first
  const aliasCode = COUNTRY_NAME_ALIASES[normalizedName];
  if (aliasCode) {
    return getCountryByCode(aliasCode);
  }

  // Fall back to exact name match
  const { priority, others } = getCountryPhoneData();
  return (
    priority.find(c => c.name.toLowerCase() === normalizedName) ||
    others.find(c => c.name.toLowerCase() === normalizedName)
  );
}

/**
 * Get flag emoji from country name
 * Returns undefined if country not found
 */
export function getFlagFromCountryName(countryName: string): string | undefined {
  const country = getCountryByName(countryName);
  return country?.flag;
}

/**
 * Validate a phone number for a specific country using libphonenumber
 */
export function validatePhoneNumber(phoneNumber: string, countryCode: CountryCode): boolean {
  if (!phoneNumber.trim()) return true; // optional field
  return isValidPhoneNumber(phoneNumber, countryCode);
}

/**
 * Format a phone number to E.164 format (e.g., +14155552671)
 */
export function formatPhoneE164(phoneNumber: string, countryCode: CountryCode): string {
  try {
    const parsed = parsePhoneNumber(phoneNumber, countryCode);
    if (parsed && parsed.isValid()) {
      return parsed.format('E.164');
    }
  } catch {
    // fall through to manual formatting
  }
  const dialCode = `+${getCountryCallingCode(countryCode)}`;
  const digits = phoneNumber.replace(/\D/g, '');
  return `${dialCode}${digits}`;
}
