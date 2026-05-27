import { describe, expect, it } from 'vitest'
import { mapTicketActionError, TicketActionFailure } from '../use-ticket-actions'

describe('mapTicketActionError — non-TicketActionFailure inputs', () => {
  it('returns UNKNOWN with the raw error message for plain Error', () => {
    expect(mapTicketActionError(new Error('boom'))).toEqual({
      code: 'UNKNOWN',
      message: 'boom',
      supportSystemDown: false,
      removeRowFromCache: false,
    })
  })

  it('returns the generic fallback for non-Error throws', () => {
    const result = mapTicketActionError('a string thrown bare')
    expect(result.code).toBe('UNKNOWN')
    expect(result.message).toMatch(/something went wrong/i)
    expect(result.supportSystemDown).toBe(false)
    expect(result.removeRowFromCache).toBe(false)
  })

  it('returns the generic fallback for null', () => {
    const result = mapTicketActionError(null)
    expect(result.code).toBe('UNKNOWN')
    expect(result.message).toMatch(/something went wrong/i)
  })

  // (Removed: SSE decoder error mapping was deleted when the form path
  // moved from propose → confirm-tool SSE to single-POST JSON via
  // /api/chat/agent/ticket-action. No SSE is read on this path, so
  // there's no protocol-leak message to friendlify.)
})

describe('mapTicketActionError — TicketActionFailure code branches', () => {
  it('PROPOSAL_NOT_CLAIMABLE → silent-able copy, no support-down', () => {
    const r = mapTicketActionError(new TicketActionFailure('PROPOSAL_NOT_CLAIMABLE', 'race'))
    expect(r.code).toBe('PROPOSAL_NOT_CLAIMABLE')
    expect(r.supportSystemDown).toBe(false)
    expect(r.removeRowFromCache).toBe(false)
  })

  it('TICKET_NOT_FOUND → removeRowFromCache=true', () => {
    const r = mapTicketActionError(new TicketActionFailure('TICKET_NOT_FOUND', 'gone'))
    expect(r.code).toBe('TICKET_NOT_FOUND')
    expect(r.removeRowFromCache).toBe(true)
    expect(r.supportSystemDown).toBe(false)
  })

  it('TICKET_OWNERSHIP_DENIED → no support-down, no cache removal', () => {
    const r = mapTicketActionError(new TicketActionFailure('TICKET_OWNERSHIP_DENIED', 'denied'))
    expect(r.code).toBe('TICKET_OWNERSHIP_DENIED')
    expect(r.supportSystemDown).toBe(false)
    expect(r.removeRowFromCache).toBe(false)
  })

  it('HUBSPOT_DISCONNECTED → supportSystemDown=true', () => {
    const r = mapTicketActionError(new TicketActionFailure('HUBSPOT_DISCONNECTED', 'down'))
    expect(r.code).toBe('HUBSPOT_DISCONNECTED')
    expect(r.supportSystemDown).toBe(true)
    expect(r.removeRowFromCache).toBe(false)
  })

  it('RATE_LIMITED with Retry-After surfaces seconds', () => {
    const response = new Response(null, { status: 429, headers: { 'Retry-After': '45' } })
    const r = mapTicketActionError(new TicketActionFailure('RATE_LIMITED', '429', response))
    expect(r.code).toBe('RATE_LIMITED')
    expect(r.retryAfterSeconds).toBe(45)
    expect(r.message).toContain('45')
  })

  it('RATE_LIMITED without Retry-After falls back to generic copy', () => {
    const r = mapTicketActionError(new TicketActionFailure('RATE_LIMITED', '429'))
    expect(r.code).toBe('RATE_LIMITED')
    expect(r.retryAfterSeconds).toBeUndefined()
    expect(r.message).toMatch(/try again/i)
  })

  it('INVALID_TOOL_ARGS → readable copy, no flags set', () => {
    const r = mapTicketActionError(new TicketActionFailure('INVALID_TOOL_ARGS', 'bad'))
    expect(r.code).toBe('INVALID_TOOL_ARGS')
    expect(r.supportSystemDown).toBe(false)
    expect(r.removeRowFromCache).toBe(false)
  })

  it('UNKNOWN code falls through with the failure message', () => {
    const r = mapTicketActionError(new TicketActionFailure('UNKNOWN', 'odd'))
    expect(r.code).toBe('UNKNOWN')
    expect(r.message).toBe('odd')
  })
})
