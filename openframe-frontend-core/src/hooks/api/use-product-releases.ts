'use client'

/**
 * React Query hooks for Product Releases
 * Shared across all platforms via ui-kit
 *
 * IMPORTANT: These hooks require QueryClientProvider in the consuming app.
 * They are client-only hooks and should only be used in client components.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../use-toast'
import type {
  ProductRelease,
  CreateProductReleaseData,
  UpdateProductReleaseData,
  ProductReleaseFilters,
  ProductReleaseListResponse
} from '../../types/product-release'

// Query keys for cache management
export const releaseKeys = {
  all: ['releases'] as const,
  lists: () => [...releaseKeys.all, 'list'] as const,
  list: (filters: ProductReleaseFilters) => [...releaseKeys.lists(), filters] as const,
  details: () => [...releaseKeys.all, 'detail'] as const,
  detail: (slug: string) => [...releaseKeys.details(), slug] as const,
  admin: {
    all: ['admin', 'releases'] as const,
    lists: (platform?: string) => ['admin', 'releases', platform || 'all'] as const,
    detail: (slug: string) => ['admin', 'release', slug] as const,
  }
}

/**
 * Fetch releases list (public)
 */
export function useReleases(filters?: ProductReleaseFilters) {
  return useQuery({
    queryKey: releaseKeys.list(filters || {}),
    queryFn: async (): Promise<ProductReleaseListResponse> => {
      const params = new URLSearchParams()
      if (filters?.tags) params.set('tags', filters.tags.join(','))
      if (filters?.version) params.set('version', filters.version)
      if (filters?.release_type) params.set('release_type', filters.release_type.join(','))
      if (filters?.release_status) params.set('release_status', filters.release_status.join(','))
      if (filters?.has_breaking_changes) params.set('has_breaking_changes', 'true')
      if (filters?.search) params.set('search', filters.search)
      if (filters?.featured) params.set('featured', 'true')
      if (filters?.limit) params.set('limit', filters.limit.toString())
      if (filters?.offset) params.set('offset', filters.offset.toString())

      const response = await fetch(`/api/releases?${params}`)
      if (!response.ok) throw new Error('Failed to fetch releases')
      return response.json()
    },
  })
}

/**
 * Fetch single release (public)
 */
export function useRelease(slug: string | undefined) {
  return useQuery({
    queryKey: releaseKeys.detail(slug || ''),
    queryFn: async (): Promise<ProductRelease> => {
      const response = await fetch(`/api/releases/${slug}`)
      if (!response.ok) throw new Error('Failed to fetch release')
      return response.json()
    },
    enabled: !!slug,
  })
}

/**
 * Admin: Fetch releases list (all statuses)
 */
export function useAdminReleases(platform?: string) {
  return useQuery({
    queryKey: releaseKeys.admin.lists(platform),
    queryFn: async (): Promise<ProductReleaseListResponse> => {
      const params = new URLSearchParams({ platform: platform || 'all' })
      const response = await fetch(`/api/admin/product-releases?${params}`)
      if (!response.ok) throw new Error('Failed to fetch releases')
      return response.json()
    },
  })
}

/**
 * Admin: Fetch single release for editing
 */
export function useAdminRelease(slug: string | undefined) {
  return useQuery({
    queryKey: releaseKeys.admin.detail(slug || ''),
    queryFn: async (): Promise<ProductRelease> => {
      const response = await fetch(`/api/admin/product-releases/${slug}`)
      if (!response.ok) throw new Error('Failed to fetch release')
      return response.json()
    },
    enabled: !!slug,
  })
}

/**
 * Admin: Create release mutation
 */
export function useCreateRelease() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (data: CreateProductReleaseData): Promise<ProductRelease> => {
      const response = await fetch('/api/admin/product-releases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create release')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: releaseKeys.admin.all })
      queryClient.invalidateQueries({ queryKey: releaseKeys.all })
      toast({
        title: 'Success',
        description: 'Release created successfully',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}

/**
 * Admin: Update release mutation
 */
export function useUpdateRelease(slug: string) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (data: UpdateProductReleaseData): Promise<ProductRelease> => {
      const response = await fetch(`/api/admin/product-releases/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update release')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: releaseKeys.admin.all })
      queryClient.invalidateQueries({ queryKey: releaseKeys.admin.detail(slug) })
      queryClient.invalidateQueries({ queryKey: releaseKeys.all })
      toast({
        title: 'Success',
        description: 'Release updated successfully',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}

/**
 * Admin: Delete release mutation
 */
export function useDeleteRelease() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (slug: string): Promise<{ success: boolean }> => {
      const response = await fetch(`/api/admin/product-releases/${slug}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete release')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: releaseKeys.admin.all })
      queryClient.invalidateQueries({ queryKey: releaseKeys.all })
      toast({
        title: 'Success',
        description: 'Release deleted successfully',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}
