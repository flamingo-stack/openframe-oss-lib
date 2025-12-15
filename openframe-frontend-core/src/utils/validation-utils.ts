/**
 * Email Domain Validation Utilities
 *
 * Validates email domain formats (the part after @ in email addresses)
 * Used for SSO domain allowlist feature to restrict auto-provisioning to specific domains.
 */

/**
 * Validates an email domain format (the part after @ in email addresses)
 * Valid: example.com, sub.domain.org, my-company.co.uk
 * Invalid: http://example.com, @example.com, example, .com
 *
 * @param domain - The domain string to validate
 * @returns true if the domain is a valid email domain format
 */
export function isValidEmailDomain(domain: string): boolean {
  if (!domain || typeof domain !== 'string') {
    return false
  }

  const trimmed = domain.trim()
  if (!trimmed) {
    return false
  }

  // Domain regex: must have at least one dot, valid characters, and proper TLD
  // Allows subdomains, hyphens (not at start/end of labels), alphanumeric characters
  const domainRegex = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z0-9-]{1,63})*\.[A-Za-z]{2,}$/
  return domainRegex.test(trimmed)
}

/**
 * Validation result type
 */
export interface EmailDomainValidationResult {
  valid: boolean
  error?: string
  cleanedDomain?: string
}

/**
 * Validates an email domain with detailed error messages
 * Also cleans the input (removes leading @, trims whitespace)
 *
 * @param domain - The domain string to validate
 * @returns Validation result with error message if invalid
 */
export function validateEmailDomain(domain: string): EmailDomainValidationResult {
  if (!domain || typeof domain !== 'string') {
    return { valid: false, error: 'Email domain is required' }
  }

  // Clean the input: trim and remove leading @ if user enters it
  let trimmed = domain.trim()
  if (trimmed.startsWith('@')) {
    trimmed = trimmed.substring(1)
  }

  // Check for empty after cleaning
  if (!trimmed) {
    return { valid: false, error: 'Email domain is required' }
  }

  // Check for protocol (common mistake: entering full URL)
  if (trimmed.includes('://')) {
    return { valid: false, error: 'Enter email domain only (e.g., openframe.ai), not a URL' }
  }

  // Check for @ symbol (common mistake: entering full email address)
  if (trimmed.includes('@')) {
    return { valid: false, error: 'Enter domain only, not a full email address' }
  }

  // Check for spaces
  if (trimmed.includes(' ')) {
    return { valid: false, error: 'Domain cannot contain spaces' }
  }

  // Check for trailing slash
  if (trimmed.includes('/')) {
    return { valid: false, error: 'Enter domain only, without paths' }
  }

  // Validate the domain format
  if (!isValidEmailDomain(trimmed)) {
    return { valid: false, error: 'Invalid domain format (e.g., openframe.ai)' }
  }

  // Return success with the cleaned domain
  return { valid: true, cleanedDomain: trimmed.toLowerCase() }
}

/**
 * Validates a list of email domains
 * Returns the first error encountered or success if all domains are valid
 *
 * @param domains - Array of domain strings to validate
 * @returns Validation result with array of cleaned domains if valid
 */
export function validateEmailDomainList(domains: string[]): {
  valid: boolean
  error?: string
  cleanedDomains?: string[]
} {
  if (!Array.isArray(domains)) {
    return { valid: false, error: 'Domains must be an array' }
  }

  const cleanedDomains: string[] = []
  const seenDomains = new Set<string>()

  for (const domain of domains) {
    const result = validateEmailDomain(domain)

    if (!result.valid) {
      return { valid: false, error: `Invalid domain "${domain}": ${result.error}` }
    }

    const cleanedDomain = result.cleanedDomain!

    // Check for duplicates (case-insensitive)
    if (seenDomains.has(cleanedDomain)) {
      return { valid: false, error: `Duplicate domain: ${cleanedDomain}` }
    }

    seenDomains.add(cleanedDomain)
    cleanedDomains.push(cleanedDomain)
  }

  return { valid: true, cleanedDomains }
}

/**
 * Cleans a domain string by removing common user input mistakes
 * Does NOT validate - use validateEmailDomain for validation
 *
 * @param domain - The domain string to clean
 * @returns Cleaned domain string
 */
export function cleanEmailDomain(domain: string): string {
  if (!domain || typeof domain !== 'string') {
    return ''
  }

  let cleaned = domain.trim().toLowerCase()

  // Remove leading @
  if (cleaned.startsWith('@')) {
    cleaned = cleaned.substring(1)
  }

  // Remove protocol if present
  cleaned = cleaned.replace(/^https?:\/\//, '')

  // Remove trailing slash and path
  cleaned = cleaned.split('/')[0]

  // Remove www. prefix
  cleaned = cleaned.replace(/^www\./, '')

  return cleaned
}
