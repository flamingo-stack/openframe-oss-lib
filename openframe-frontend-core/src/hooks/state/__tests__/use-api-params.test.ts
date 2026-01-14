import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockReplace, setMockSearchParams } from '../../../../vitest.setup'
import { createSearchParams, useApiParams } from '../use-api-params'

describe('useApiParams', () => {
  beforeEach(() => {
    // Reset URL before each test
    setMockSearchParams(new URLSearchParams())
    window.location.pathname = '/'
    mockReplace.mockClear()
  })

  describe('Basic functionality', () => {
    it('should initialize with default values when URL is empty', () => {
      const schema = {
        search: { type: 'string' as const, default: '' },
        page: { type: 'number' as const, default: 1 },
        tags: { type: 'array' as const, default: [] },
      }

      const { result } = renderHook(() => useApiParams(schema))

      expect(result.current.params).toEqual({
        search: '',
        page: 1,
        tags: [],
      })
    })

    it('should parse URL parameters correctly', () => {
      const params = new URLSearchParams()
      params.set('search', 'laptop')
      params.set('page', '2')
      params.append('tags', 'electronics')
      params.append('tags', 'sale')
      setMockSearchParams(params)

      const schema = {
        search: { type: 'string' as const, default: '' },
        page: { type: 'number' as const, default: 1 },
        tags: { type: 'array' as const, default: [] },
      }

      const { result } = renderHook(() => useApiParams(schema))

      expect(result.current.params).toEqual({
        search: 'laptop',
        page: 2,
        tags: ['electronics', 'sale'],
      })
    })

    it('should coerce string to number', () => {
      const params = new URLSearchParams()
      params.set('page', '5')
      setMockSearchParams(params)

      const schema = {
        page: { type: 'number' as const, default: 1 },
      }

      const { result } = renderHook(() => useApiParams(schema))

      expect(result.current.params.page).toBe(5)
      expect(typeof result.current.params.page).toBe('number')
    })

    it('should coerce string to boolean', () => {
      const params = new URLSearchParams()
      params.set('active', 'true')
      setMockSearchParams(params)

      const schema = {
        active: { type: 'boolean' as const, default: false },
      }

      const { result } = renderHook(() => useApiParams(schema))

      expect(result.current.params.active).toBe(true)
    })
  })

  describe('Array parameters', () => {
    it('should handle array parameters with multiple values', () => {
      const params = new URLSearchParams()
      params.append('ids', '1')
      params.append('ids', '2')
      params.append('ids', '3')
      setMockSearchParams(params)

      const schema = {
        ids: { type: 'array' as const, default: [] },
      }

      const { result } = renderHook(() => useApiParams(schema))

      expect(result.current.params.ids).toEqual(['1', '2', '3'])
    })

    it('should handle empty array in URL', () => {
      const schema = {
        tags: { type: 'array' as const, default: [] },
      }

      const { result } = renderHook(() => useApiParams(schema))

      expect(result.current.params.tags).toEqual([])
    })

    it('should set array parameter correctly', () => {
      const schema = {
        ids: { type: 'array' as const, default: [] },
      }

      const { result } = renderHook(() => useApiParams(schema))

      act(() => {
        result.current.setParam('ids', ['1', '2', '3'])
      })

      // Check that router.replace was called with correct URL
      expect(mockReplace).toHaveBeenCalled()
      const callArg = mockReplace.mock.calls[0][0]
      const urlParams = new URLSearchParams(callArg.startsWith('?') ? callArg.slice(1) : callArg)
      
      expect(urlParams.getAll('ids')).toEqual(['1', '2', '3'])
    })

    it('should remove array parameter when setting empty array after it had multiple values', () => {
      const params = new URLSearchParams()
      params.append('tags', 'value1')
      params.append('tags', 'value2')
      params.append('tags', 'value3')
      setMockSearchParams(params)

      const schema = {
        tags: { type: 'array' as const, default: [] },
      }

      const { result } = renderHook(() => useApiParams(schema))

      // Verify initial state has multiple values
      expect(result.current.params.tags).toEqual(['value1', 'value2', 'value3'])

      act(() => {
        result.current.setParam('tags', [])
      })

      // Check that the parameter is removed from URL
      expect(mockReplace).toHaveBeenCalled()
      const callArg = mockReplace.mock.calls[0][0]
      const urlParams = new URLSearchParams(callArg.startsWith('?') ? callArg.slice(1) : callArg)
      
      expect(urlParams.has('tags')).toBe(false)
    })
  })

  describe('setParam', () => {
    it('should update a single parameter', () => {
      const schema = {
        search: { type: 'string' as const, default: '' },
      }

      const { result } = renderHook(() => useApiParams(schema))

      act(() => {
        result.current.setParam('search', 'laptop')
      })

      expect(mockReplace).toHaveBeenCalled()
      const callArg = mockReplace.mock.calls[0][0]
      expect(callArg).toContain('search=laptop')
    })

    it('should remove parameter when set to empty string', () => {
      const params = new URLSearchParams()
      params.set('search', 'laptop')
      setMockSearchParams(params)

      const schema = {
        search: { type: 'string' as const, default: '' },
      }

      const { result } = renderHook(() => useApiParams(schema))

      act(() => {
        result.current.setParam('search', '')
      })

      expect(mockReplace).toHaveBeenCalled()
      const callArg = mockReplace.mock.calls[0][0]
      if (callArg && callArg !== '/') {
        const urlParams = new URLSearchParams(callArg.startsWith('?') ? callArg.slice(1) : callArg)
        expect(urlParams.has('search')).toBe(false)
      } else {
        expect(callArg).toBe('/')
      }
    })

    it('should warn when setting unknown parameter', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const schema = {
        search: { type: 'string' as const, default: '' },
      }

      const { result } = renderHook(() => useApiParams(schema))

      act(() => {
        result.current.setParam('unknown' as 'search', 'value')
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown parameter: unknown')
      )

      consoleSpy.mockRestore()
    })

    it('should handle null and undefined values', () => {
      const params = new URLSearchParams()
      params.set('search', 'laptop')
      setMockSearchParams(params)

      const schema = {
        search: { type: 'string' as const, default: '' },
      }

      const { result } = renderHook(() => useApiParams(schema))

      act(() => {
        result.current.setParam('search', null)
      })

      // null is now converted to string "null" instead of being filtered
      const callArg = mockReplace.mock.calls[0][0]
      if (callArg && callArg !== '/') {
        const urlParams = new URLSearchParams(callArg.startsWith('?') ? callArg.slice(1) : callArg)
        expect(urlParams.get('search')).toBe('null')
      } else {
        // If null is treated as empty, it should be removed
        const urlParams = new URLSearchParams(callArg.startsWith('?') ? callArg.slice(1) : callArg)
        expect(urlParams.has('search')).toBe(false)
      }
    })
  })

  describe('setParams', () => {
    it('should update multiple parameters at once', () => {
      const schema = {
        search: { type: 'string' as const, default: '' },
        page: { type: 'number' as const, default: 1 },
      }

      const { result } = renderHook(() => useApiParams(schema))

      act(() => {
        result.current.setParams({
          search: 'laptop',
          page: 5,
        })
      })

      expect(mockReplace).toHaveBeenCalled()
      const callArg = mockReplace.mock.calls[0][0]
      const urlParams = new URLSearchParams(callArg.startsWith('?') ? callArg.slice(1) : callArg)
      expect(urlParams.get('search')).toBe('laptop')
      expect(urlParams.get('page')).toBe('5')
    })

    it('should handle array parameters in setParams', () => {
      const schema = {
        ids: { type: 'array' as const, default: [] },
        tags: { type: 'array' as const, default: [] },
      }

      const { result } = renderHook(() => useApiParams(schema))

      act(() => {
        result.current.setParams({
          ids: ['1', '2', '3'],
          tags: ['a', 'b'],
        })
      })

      const callArg = mockReplace.mock.calls[0][0]
      const urlParams = new URLSearchParams(callArg.startsWith('?') ? callArg.slice(1) : callArg)
      expect(urlParams.getAll('ids')).toEqual(['1', '2', '3'])
      expect(urlParams.getAll('tags')).toEqual(['a', 'b'])
    })

    it('should skip unknown parameters in setParams', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const schema = {
        search: { type: 'string' as const, default: '' },
      }

      const { result } = renderHook(() => useApiParams(schema))

      act(() => {
        result.current.setParams({
          search: 'laptop',
          unknown: 'value',
        } as Parameters<typeof result.current.setParams>[0])
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown parameter: unknown')
      )

      consoleSpy.mockRestore()
    })
  })

  describe('clearParams', () => {
    it('should clear specified parameters', () => {
      const params = new URLSearchParams()
      params.set('search', 'laptop')
      params.set('page', '2')
      setMockSearchParams(params)

      const schema = {
        search: { type: 'string' as const, default: '' },
        page: { type: 'number' as const, default: 1 },
      }

      const { result } = renderHook(() => useApiParams(schema))

      act(() => {
        result.current.clearParams(['search'])
      })

      expect(mockReplace).toHaveBeenCalled()
      const callArg = mockReplace.mock.calls[0][0]
      const urlParams = new URLSearchParams(callArg.startsWith('?') ? callArg.slice(1) : callArg)
      expect(urlParams.has('search')).toBe(false)
      expect(urlParams.has('page')).toBe(true)
    })

    it('should clear multiple parameters', () => {
      const params = new URLSearchParams()
      params.set('search', 'laptop')
      params.set('page', '2')
      params.append('tags', 'electronics')
      setMockSearchParams(params)

      const schema = {
        search: { type: 'string' as const, default: '' },
        page: { type: 'number' as const, default: 1 },
        tags: { type: 'array' as const, default: [] },
      }

      const { result } = renderHook(() => useApiParams(schema))

      act(() => {
        result.current.clearParams(['search', 'tags'])
      })

      const callArg = mockReplace.mock.calls[0][0]
      const urlParams = new URLSearchParams(callArg.startsWith('?') ? callArg.slice(1) : callArg)
      expect(urlParams.has('search')).toBe(false)
      expect(urlParams.has('tags')).toBe(false)
      expect(urlParams.has('page')).toBe(true)
    })
  })

  describe('resetParams', () => {
    it('should reset all parameters and clear URL', () => {
      const params = new URLSearchParams()
      params.set('search', 'laptop')
      params.set('page', '2')
      setMockSearchParams(params)

      const schema = {
        search: { type: 'string' as const, default: '' },
        page: { type: 'number' as const, default: 1 },
      }

      const { result } = renderHook(() => useApiParams(schema))

      act(() => {
        result.current.resetParams()
      })

      expect(mockReplace).toHaveBeenCalledWith('/', { scroll: false })
    })
  })

  describe('urlSearchParams', () => {
    it('should generate URLSearchParams correctly', () => {
      const params = new URLSearchParams()
      params.set('search', 'laptop')
      params.set('page', '2')
      setMockSearchParams(params)

      const schema = {
        search: { type: 'string' as const, default: '' },
        page: { type: 'number' as const, default: 1 },
      }

      const { result } = renderHook(() => useApiParams(schema))

      expect(result.current.urlSearchParams.get('search')).toBe('laptop')
      expect(result.current.urlSearchParams.get('page')).toBe('2')
    })

    it('should handle array parameters in urlSearchParams', () => {
      const params = new URLSearchParams()
      params.append('ids', '1')
      params.append('ids', '2')
      params.append('ids', '3')
      setMockSearchParams(params)

      const schema = {
        ids: { type: 'array' as const, default: [] },
      }

      const { result } = renderHook(() => useApiParams(schema))

      const allIds = result.current.urlSearchParams.getAll('ids')
      expect(allIds).toEqual(['1', '2', '3'])
    })

    it('should exclude default values from urlSearchParams', () => {
      const schema = {
        search: { type: 'string' as const, default: '' },
        page: { type: 'number' as const, default: 1 },
      }

      const { result } = renderHook(() => useApiParams(schema))

      expect(result.current.urlSearchParams.has('search')).toBe(false)
      expect(result.current.urlSearchParams.has('page')).toBe(false)
    })
  })

  describe('Edge cases', () => {
    it('should handle empty schema', () => {
      const schema = {}

      const { result } = renderHook(() => useApiParams(schema))

      expect(result.current.params).toEqual({})
    })

    it('should handle required parameters', () => {
      const schema = {
        id: { type: 'string' as const, required: true },
      }

      const { result } = renderHook(() => useApiParams(schema))

      // Required param without default should be undefined
      expect(result.current.params.id).toBeUndefined()
    })

    it('should preserve non-schema parameters in URL', () => {
      const params = new URLSearchParams()
      params.set('search', 'laptop')
      params.set('external', 'value')
      setMockSearchParams(params)

      const schema = {
        search: { type: 'string' as const, default: '' },
      }

      const { result } = renderHook(() => useApiParams(schema))

      act(() => {
        result.current.setParam('search', 'desktop')
      })

      // External param should be preserved
      const callArg = mockReplace.mock.calls[0][0]
      const urlParams = new URLSearchParams(callArg.startsWith('?') ? callArg.slice(1) : callArg)
      expect(urlParams.get('external')).toBe('value')
    })

    it('should preserve multiple non-schema parameters', () => {
      const params = new URLSearchParams()
      params.set('search', 'laptop')
      params.set('external1', 'value1')
      params.set('external2', 'value2')
      params.append('external3', 'value3a')
      params.append('external3', 'value3b')
      setMockSearchParams(params)

      const schema = {
        search: { type: 'string' as const, default: '' },
      }

      const { result } = renderHook(() => useApiParams(schema))

      act(() => {
        result.current.setParam('search', 'desktop')
      })

      const callArg = mockReplace.mock.calls[0][0]
      const urlParams = new URLSearchParams(callArg.startsWith('?') ? callArg.slice(1) : callArg)
      expect(urlParams.get('external1')).toBe('value1')
      expect(urlParams.get('external2')).toBe('value2')
      // external3 should be preserved (all values)
      const external3Values = urlParams.getAll('external3')
      expect(external3Values).toContain('value3a')
      expect(external3Values).toContain('value3b')
      expect(external3Values.length).toBeGreaterThanOrEqual(2)
    })

    it('should not duplicate parameters when updating', () => {
      const params = new URLSearchParams()
      params.set('search', 'laptop')
      params.set('page', '1')
      params.set('external', 'value')
      setMockSearchParams(params)

      const schema = {
        search: { type: 'string' as const, default: '' },
        page: { type: 'number' as const, default: 1 },
      }

      const { result } = renderHook(() => useApiParams(schema))

      act(() => {
        result.current.setParam('page', 2)
      })

      const callArg = mockReplace.mock.calls[0][0]
      const urlParams = new URLSearchParams(callArg.startsWith('?') ? callArg.slice(1) : callArg)
      
      // Check that parameters are not duplicated
      expect(urlParams.getAll('search')).toHaveLength(1)
      expect(urlParams.getAll('page')).toHaveLength(1)
      expect(urlParams.getAll('external')).toHaveLength(1)
      
      // Check values
      expect(urlParams.get('search')).toBe('laptop')
      expect(urlParams.get('page')).toBe('2')
      expect(urlParams.get('external')).toBe('value')
    })

    it('should not duplicate array parameters when updating', () => {
      const params = new URLSearchParams()
      params.append('tags', 'tag1')
      params.append('tags', 'tag2')
      params.set('external', 'value')
      setMockSearchParams(params)

      const schema = {
        tags: { type: 'array' as const, default: [] },
      }

      const { result } = renderHook(() => useApiParams(schema))

      act(() => {
        result.current.setParam('tags', ['tag3', 'tag4'])
      })

      const callArg = mockReplace.mock.calls[0][0]
      const urlParams = new URLSearchParams(callArg.startsWith('?') ? callArg.slice(1) : callArg)
      
      // Check that tags are not duplicated
      const tags = urlParams.getAll('tags')
      expect(tags).toEqual(['tag3', 'tag4'])
      expect(tags.length).toBe(2)
      
      // External param should be preserved once
      expect(urlParams.getAll('external')).toHaveLength(1)
      expect(urlParams.get('external')).toBe('value')
    })

    it('should handle array with empty strings', () => {
      const schema = {
        tags: { type: 'array' as const, default: [] },
      }

      const { result } = renderHook(() => useApiParams(schema))

      act(() => {
        result.current.setParam('tags', ['valid', '', 'also-valid'])
      })

      const callArg = mockReplace.mock.calls[0][0]
      const urlParams = new URLSearchParams(callArg.startsWith('?') ? callArg.slice(1) : callArg)
      const tags = urlParams.getAll('tags')
      // Empty strings should be filtered out
      expect(tags).toEqual(['valid', 'also-valid'])
    })

    it('should handle array with null/undefined values', () => {
      const schema = {
        tags: { type: 'array' as const, default: [] },
      }

      const { result } = renderHook(() => useApiParams(schema))

      act(() => {
        result.current.setParam('tags', ['valid', null, undefined, 'also-valid'])
      })

      const callArg = mockReplace.mock.calls[0][0]
      const urlParams = new URLSearchParams(callArg.startsWith('?') ? callArg.slice(1) : callArg)
      const tags = urlParams.getAll('tags')
      // null, undefined and empty strings are filtered out
      expect(tags).toEqual(['valid', 'also-valid'])
    })

    it('should handle URL encoding with special characters', () => {
      const schema = {
        search: { type: 'string' as const, default: '' },
      }

      const { result } = renderHook(() => useApiParams(schema))

      const specialChars = 'test & value?key=value&other=123'
      act(() => {
        result.current.setParam('search', specialChars)
      })

      const callArg = mockReplace.mock.calls[0][0]
      const urlParams = new URLSearchParams(callArg.startsWith('?') ? callArg.slice(1) : callArg)
      expect(urlParams.get('search')).toBe(specialChars)
    })

    it('should handle very long parameter values', () => {
      const schema = {
        search: { type: 'string' as const, default: '' },
      }

      const { result } = renderHook(() => useApiParams(schema))

      const longValue = 'a'.repeat(10000)
      act(() => {
        result.current.setParam('search', longValue)
      })

      const callArg = mockReplace.mock.calls[0][0]
      const urlParams = new URLSearchParams(callArg.startsWith('?') ? callArg.slice(1) : callArg)
      expect(urlParams.get('search')).toBe(longValue)
    })

    it('should handle negative numbers', () => {
      const params = new URLSearchParams()
      params.set('offset', '-10')
      setMockSearchParams(params)

      const schema = {
        offset: { type: 'number' as const, default: 0 },
      }

      const { result } = renderHook(() => useApiParams(schema))

      expect(result.current.params.offset).toBe(-10)
      expect(typeof result.current.params.offset).toBe('number')
    })

    it('should handle floating point numbers', () => {
      const params = new URLSearchParams()
      params.set('price', '99.99')
      params.set('discount', '-0.5')
      setMockSearchParams(params)

      const schema = {
        price: { type: 'number' as const, default: 0 },
        discount: { type: 'number' as const, default: 0 },
      }

      const { result } = renderHook(() => useApiParams(schema))

      expect(result.current.params.price).toBe(99.99)
      expect(result.current.params.discount).toBe(-0.5)
    })

    it('should handle boolean false in URL', () => {
      const params = new URLSearchParams()
      params.set('active', 'false')
      setMockSearchParams(params)

      const schema = {
        active: { type: 'boolean' as const, default: true },
      }

      const { result } = renderHook(() => useApiParams(schema))

      expect(result.current.params.active).toBe(false)
    })

    it('should handle boolean with "1" and "0" values', () => {
      const params = new URLSearchParams()
      params.set('enabled', '1')
      params.set('disabled', '0')
      setMockSearchParams(params)

      const schema = {
        enabled: { type: 'boolean' as const, default: false },
        disabled: { type: 'boolean' as const, default: true },
      }

      const { result } = renderHook(() => useApiParams(schema))

      expect(result.current.params.enabled).toBe(true)
      // '0' is not 'true' or '1', so it should be false
      expect(result.current.params.disabled).toBe(false)
    })

    it('should handle multiple sequential setParam calls', () => {
      const schema = {
        search: { type: 'string' as const, default: '' },
        page: { type: 'number' as const, default: 1 },
      }

      const { result, rerender } = renderHook(() => useApiParams(schema))

      act(() => {
        result.current.setParam('search', 'first')
      })

      // Update mock to reflect first change and rerender
      const firstCall = mockReplace.mock.calls[0][0]
      const firstParams = new URLSearchParams(firstCall.startsWith('?') ? firstCall.slice(1) : firstCall)
      setMockSearchParams(firstParams)
      rerender()

      act(() => {
        result.current.setParam('page', 2)
      })

      // Update mock to reflect second change and rerender
      const secondCall = mockReplace.mock.calls[1][0]
      const secondParams = new URLSearchParams(secondCall.startsWith('?') ? secondCall.slice(1) : secondCall)
      setMockSearchParams(secondParams)
      rerender()

      act(() => {
        result.current.setParam('search', 'second')
      })

      // Check last call - should have both search and page
      const lastCall = mockReplace.mock.calls[mockReplace.mock.calls.length - 1][0]
      const urlParams = new URLSearchParams(lastCall.startsWith('?') ? lastCall.slice(1) : lastCall)
      expect(urlParams.get('search')).toBe('second')
      expect(urlParams.get('page')).toBe('2')
    })

    it('should handle very large arrays', () => {
      const schema = {
        ids: { type: 'array' as const, default: [] },
      }

      const { result } = renderHook(() => useApiParams(schema))

      const largeArray = Array.from({ length: 1000 }, (_, i) => String(i))
      act(() => {
        result.current.setParam('ids', largeArray)
      })

      const callArg = mockReplace.mock.calls[0][0]
      const urlParams = new URLSearchParams(callArg.startsWith('?') ? callArg.slice(1) : callArg)
      const allIds = urlParams.getAll('ids')
      expect(allIds).toHaveLength(1000)
      expect(allIds[0]).toBe('0')
      expect(allIds[999]).toBe('999')
    })

    it('should handle array with duplicate values', () => {
      const schema = {
        tags: { type: 'array' as const, default: [] },
      }

      const { result } = renderHook(() => useApiParams(schema))

      act(() => {
        result.current.setParam('tags', ['tag1', 'tag2', 'tag1', 'tag2'])
      })

      const callArg = mockReplace.mock.calls[0][0]
      const urlParams = new URLSearchParams(callArg.startsWith('?') ? callArg.slice(1) : callArg)
      const tags = urlParams.getAll('tags')
      expect(tags).toEqual(['tag1', 'tag2', 'tag1', 'tag2'])
    })

    it('should handle clearing array parameter and setting new value', () => {
      const params = new URLSearchParams()
      params.append('tags', 'old1')
      params.append('tags', 'old2')
      setMockSearchParams(params)

      const schema = {
        tags: { type: 'array' as const, default: [] },
      }

      const { result } = renderHook(() => useApiParams(schema))

      act(() => {
        result.current.setParam('tags', [])
      })

      act(() => {
        result.current.setParam('tags', ['new1', 'new2'])
      })

      const lastCall = mockReplace.mock.calls[mockReplace.mock.calls.length - 1][0]
      const urlParams = new URLSearchParams(lastCall.startsWith('?') ? lastCall.slice(1) : lastCall)
      const tags = urlParams.getAll('tags')
      expect(tags).toEqual(['new1', 'new2'])
    })

    it('should handle invalid number strings', () => {
      const params = new URLSearchParams()
      params.set('page', 'not-a-number')
      setMockSearchParams(params)

      const schema = {
        page: { type: 'number' as const, default: 1 },
      }

      const { result } = renderHook(() => useApiParams(schema))

      // Invalid number should coerce to null
      expect(result.current.params.page).toBeNull()
    })

    it('should handle zero as valid number', () => {
      const params = new URLSearchParams()
      params.set('count', '0')
      setMockSearchParams(params)

      const schema = {
        count: { type: 'number' as const, default: 1 },
      }

      const { result } = renderHook(() => useApiParams(schema))

      expect(result.current.params.count).toBe(0)
      expect(typeof result.current.params.count).toBe('number')
    })

    it('should handle empty string for number type', () => {
      const params = new URLSearchParams()
      params.set('page', '')
      setMockSearchParams(params)

      const schema = {
        page: { type: 'number' as const, default: 1 },
      }

      const { result } = renderHook(() => useApiParams(schema))

      // Empty string should use default
      expect(result.current.params.page).toBe(1)
    })

    it('should handle Unicode characters', () => {
      const schema = {
        search: { type: 'string' as const, default: '' },
      }

      const { result } = renderHook(() => useApiParams(schema))

      const unicodeValue = 'тест 🚀 测试'
      act(() => {
        result.current.setParam('search', unicodeValue)
      })

      const callArg = mockReplace.mock.calls[0][0]
      const urlParams = new URLSearchParams(callArg.startsWith('?') ? callArg.slice(1) : callArg)
      expect(urlParams.get('search')).toBe(unicodeValue)
    })

    it('should handle setParams with mixed valid and invalid keys', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const schema = {
        search: { type: 'string' as const, default: '' },
        page: { type: 'number' as const, default: 1 },
      }

      const { result } = renderHook(() => useApiParams(schema))

      act(() => {
        result.current.setParams({
          search: 'laptop',
          page: 5,
          invalid1: 'value1',
          invalid2: 'value2',
        } as Parameters<typeof result.current.setParams>[0])
      })

      expect(consoleSpy).toHaveBeenCalledTimes(2)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown parameter: invalid1')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown parameter: invalid2')
      )

      const callArg = mockReplace.mock.calls[0][0]
      const urlParams = new URLSearchParams(callArg.startsWith('?') ? callArg.slice(1) : callArg)
      expect(urlParams.get('search')).toBe('laptop')
      expect(urlParams.get('page')).toBe('5')
      expect(urlParams.has('invalid1')).toBe(false)
      expect(urlParams.has('invalid2')).toBe(false)

      consoleSpy.mockRestore()
    })

    it('should handle resetParams with external parameters', () => {
      const params = new URLSearchParams()
      params.set('search', 'laptop')
      params.set('external', 'value')
      setMockSearchParams(params)

      const schema = {
        search: { type: 'string' as const, default: '' },
      }

      const { result } = renderHook(() => useApiParams(schema))

      act(() => {
        result.current.resetParams()
      })

      // resetParams should clear everything, including external params
      expect(mockReplace).toHaveBeenCalledWith('/', { scroll: false })
    })

    it('should handle array parameter with only empty values', () => {
      const schema = {
        tags: { type: 'array' as const, default: [] },
      }

      const { result } = renderHook(() => useApiParams(schema))

      act(() => {
        result.current.setParam('tags', ['', null, undefined])
      })

      const callArg = mockReplace.mock.calls[0][0]
      // All values (empty string, null, undefined) are filtered out
      // So array ['', null, undefined] becomes [] and tags param is removed
      expect(callArg).toBe(window.location.pathname)
    })
  })

  describe('Debug mode', () => {
    it('should log parsed params when debug is enabled', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const params = new URLSearchParams()
      params.set('search', 'laptop')
      setMockSearchParams(params)

      const schema = {
        search: { type: 'string' as const, default: '' },
      }

      renderHook(() => useApiParams(schema, { debug: true }))

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[useApiParams] Parsed params:'),
        expect.objectContaining({ search: 'laptop' })
      )

      consoleSpy.mockRestore()
    })

    it('should log URL updates when debug is enabled', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const schema = {
        search: { type: 'string' as const, default: '' },
      }

      const { result } = renderHook(() => useApiParams(schema, { debug: true }))

      act(() => {
        result.current.setParam('search', 'laptop')
      })

      // Check that URL update was logged (may be called after parsed params log)
      const urlUpdateCall = consoleSpy.mock.calls.find(
        call => call[0]?.includes('[useApiParams] Updating URL:')
      )
      expect(urlUpdateCall).toBeDefined()

      consoleSpy.mockRestore()
    })
  })
})

describe('createSearchParams', () => {
  it('should create URLSearchParams from object', () => {
    const params = createSearchParams({
      search: 'laptop',
      page: 2,
      tags: ['electronics', 'sale'],
    })

    expect(params.get('search')).toBe('laptop')
    expect(params.get('page')).toBe('2')
    expect(params.getAll('tags')).toEqual(['electronics', 'sale'])
  })

  it('should skip undefined/empty/null values', () => {
    const params = createSearchParams({
      search: 'laptop',
      empty: '',
      nullValue: null,
      undefinedValue: undefined,
    })

    expect(params.has('search')).toBe(true)
    expect(params.has('empty')).toBe(false)
    // null is filtered out
    expect(params.has('nullValue')).toBe(false)
    expect(params.has('undefinedValue')).toBe(false)
  })

  it('should handle arrays correctly', () => {
    const params = createSearchParams({
      ids: ['1', '2', '3'],
    })

    expect(params.getAll('ids')).toEqual(['1', '2', '3'])
  })

  it('should handle arrays with empty values', () => {
    const params = createSearchParams({
      tags: ['valid', '', null, undefined, 'also-valid'] as (string | null | undefined)[],
    })

    // null, empty string and undefined are filtered out
    expect(params.getAll('tags')).toEqual(['valid', 'also-valid'])
  })

  it('should handle special characters in values', () => {
    const params = createSearchParams({
      search: 'test & value?key=value',
    })

    expect(params.get('search')).toBe('test & value?key=value')
  })

  it('should handle numbers and booleans', () => {
    const params = createSearchParams({
      count: 0,
      price: 99.99,
      active: true,
      inactive: false,
    })

    expect(params.get('count')).toBe('0')
    expect(params.get('price')).toBe('99.99')
    expect(params.get('active')).toBe('true')
    expect(params.get('inactive')).toBe('false')
  })

  it('should handle empty object', () => {
    const params = createSearchParams({})

    expect(params.toString()).toBe('')
  })
})