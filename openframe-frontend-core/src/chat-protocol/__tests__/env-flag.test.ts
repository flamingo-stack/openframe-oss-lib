import { describe, it, expect, afterEach } from 'vitest'
import { envFlagEnabled } from '../env-flag'

const NAME = 'ENV_FLAG_TEST_TRUSTED_INGRESS'

afterEach(() => {
  delete process.env[NAME]
})

describe('envFlagEnabled', () => {
  it('is false when unset', () => {
    expect(envFlagEnabled(NAME)).toBe(false)
  })

  it('is false for empty / whitespace-only values', () => {
    for (const raw of ['', '   ', '\t\n']) {
      process.env[NAME] = raw
      expect(envFlagEnabled(NAME)).toBe(false)
    }
  })

  // The whole reason this predicate is shared: a producer using bare
  // `Boolean(process.env.X)` read every one of these as ENABLED, so an
  // operator typing `=0` to mean "off" got attacker-writable IP headers
  // trusted anyway.
  it('is false for explicit off values, case- and whitespace-insensitively', () => {
    for (const raw of ['0', 'false', 'off', 'FALSE', 'Off', '  0  ', ' OFF ']) {
      process.env[NAME] = raw
      expect(envFlagEnabled(NAME)).toBe(false)
    }
  })

  it('is true for any other non-empty value', () => {
    for (const raw of ['1', 'true', 'TRUE', 'on', 'yes', ' 1 ']) {
      process.env[NAME] = raw
      expect(envFlagEnabled(NAME)).toBe(true)
    }
  })

  it('reads process.env per call, never module-hoisted', () => {
    expect(envFlagEnabled(NAME)).toBe(false)
    process.env[NAME] = '1'
    expect(envFlagEnabled(NAME)).toBe(true)
    process.env[NAME] = '0'
    expect(envFlagEnabled(NAME)).toBe(false)
  })

  it('is reachable from the ./chat-protocol barrel', async () => {
    const barrel = await import('../index')
    expect(barrel.envFlagEnabled).toBe(envFlagEnabled)
  })
})
