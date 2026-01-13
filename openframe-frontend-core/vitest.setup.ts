import '@testing-library/jest-dom'
import { beforeEach, vi } from 'vitest'

// Mock Next.js router
export const mockReplace = vi.fn()
export const mockPush = vi.fn()

// Create a mutable searchParams that can be updated in tests
export let mockSearchParams = new URLSearchParams()

export function setMockSearchParams(params: URLSearchParams) {
  mockSearchParams = params
}

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/',
}))

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    pathname: '/',
    search: '',
    href: 'http://localhost:3000/',
  },
  writable: true,
})

// Reset mocks before each test
beforeEach(() => {
  mockReplace.mockClear()
  mockPush.mockClear()
  mockSearchParams = new URLSearchParams()
})

