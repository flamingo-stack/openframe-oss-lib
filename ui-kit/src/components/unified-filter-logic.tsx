"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { useTransition } from "react"

/**
 * Unified AND Filter Logic
 * 
 * This module provides common filtering logic that uses AND operations
 * instead of OR operations for all filter combinations.
 */

export interface FilterState {
  search?: string
  categories?: string[]
  subcategories?: string[]
  tags?: string[]
  filters?: string[]
  pricing?: string
  page?: number
}

export interface FilterConfig {
  basePath: string
  supportedFilters: {
    categories?: boolean
    subcategories?: boolean
    tags?: boolean
    filters?: boolean
    pricing?: boolean
    search?: boolean
  }
}

/**
 * Hook for managing AND-based filter logic
 */
export function useUnifiedFiltering(config: FilterConfig) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // Parse current filter state from URL
  const getCurrentFilterState = (): FilterState => {
    const search = searchParams?.get('search') || undefined
    const categories = searchParams?.get('category')?.split(',').filter(Boolean) || []
    const subcategories = searchParams?.get('subcategory')?.split(',').filter(Boolean) || []
    const tags = searchParams?.get('tag')?.split(',').filter(Boolean) || []
    const filters = searchParams?.getAll('filter') || []
    const pricing = searchParams?.get('pricing') || undefined
    const page = parseInt(searchParams?.get('page') || "1")

    return {
      search,
      categories,
      subcategories,
      tags,
      filters,
      pricing,
      page
    }
  }

  // Update filters with AND logic
  const updateFilters = (newFilters: Partial<FilterState>, preserveScroll = false) => {
    const currentState = getCurrentFilterState()
    const updatedState = { ...currentState, ...newFilters }
    
    // Always reset to page 1 when filters change (unless explicitly preserving page)
    if (!newFilters.hasOwnProperty('page')) {
      updatedState.page = 1
    }

    const params = new URLSearchParams()

    // Add search parameter
    if (updatedState.search && config.supportedFilters.search) {
      params.set('search', updatedState.search)
    }

    // Add category parameters (AND logic - all must match)
    if (updatedState.categories && updatedState.categories.length > 0 && config.supportedFilters.categories) {
      params.set('category', updatedState.categories.join(','))
    }

    // Add subcategory parameters (AND logic - all must match)
    if (updatedState.subcategories && updatedState.subcategories.length > 0 && config.supportedFilters.subcategories) {
      params.set('subcategory', updatedState.subcategories.join(','))
    }

    // Add tag parameters (AND logic - all must match)
    if (updatedState.tags && updatedState.tags.length > 0 && config.supportedFilters.tags) {
      params.set('tag', updatedState.tags.join(','))
    }

    // Add filter parameters (AND logic - all must match)
    if (updatedState.filters && updatedState.filters.length > 0 && config.supportedFilters.filters) {
      updatedState.filters.forEach(filter => params.append('filter', filter))
    }

    // Add pricing parameter
    if (updatedState.pricing && config.supportedFilters.pricing) {
      params.set('pricing', updatedState.pricing)
    }

    // Add page parameter (only if not page 1)
    if (updatedState.page && updatedState.page > 1) {
      params.set('page', updatedState.page.toString())
    }

    const currentScrollY = preserveScroll ? window.scrollY : 0
    const newUrl = `${config.basePath}?${params.toString()}`

    startTransition(() => {
      router.push(newUrl, { scroll: false })
      
      if (preserveScroll) {
        setTimeout(() => {
          window.scrollTo({
            top: currentScrollY,
            behavior: 'smooth'
          })
        }, 100)
      }
    })
  }

  // Add a filter (AND logic)
  const addFilter = (
    type: keyof FilterState,
    value: string,
    preserveScroll = false
  ) => {
    const currentState = getCurrentFilterState()
    const updates: Partial<FilterState> = {}

    switch (type) {
      case 'categories':
        updates.categories = [...(currentState.categories || []), value]
        break
      case 'subcategories':
        updates.subcategories = [...(currentState.subcategories || []), value]
        break
      case 'tags':
        updates.tags = [...(currentState.tags || []), value]
        break
      case 'filters':
        updates.filters = [...(currentState.filters || []), value]
        break
      case 'pricing':
        updates.pricing = value
        break
      case 'search':
        updates.search = value
        break
    }

    updateFilters(updates, preserveScroll)
  }

  // Remove a filter (AND logic)
  const removeFilter = (
    type: keyof FilterState,
    value?: string,
    preserveScroll = true
  ) => {
    const currentState = getCurrentFilterState()
    const updates: Partial<FilterState> = {}

    switch (type) {
      case 'categories':
        updates.categories = value 
          ? (currentState.categories || []).filter(c => c !== value)
          : []
        break
      case 'subcategories':
        updates.subcategories = value 
          ? (currentState.subcategories || []).filter(s => s !== value)
          : []
        break
      case 'tags':
        updates.tags = value 
          ? (currentState.tags || []).filter(t => t !== value)
          : []
        break
      case 'filters':
        updates.filters = value 
          ? (currentState.filters || []).filter(f => f !== value)
          : []
        break
      case 'pricing':
        updates.pricing = undefined
        break
      case 'search':
        updates.search = undefined
        break
    }

    updateFilters(updates, preserveScroll)
  }

  // Toggle a filter (AND logic)
  const toggleFilter = (
    type: keyof FilterState,
    value: string,
    preserveScroll = false
  ) => {
    const currentState = getCurrentFilterState()
    let currentValues: string[] = []

    switch (type) {
      case 'categories':
        currentValues = currentState.categories || []
        break
      case 'subcategories':
        currentValues = currentState.subcategories || []
        break
      case 'tags':
        currentValues = currentState.tags || []
        break
      case 'filters':
        currentValues = currentState.filters || []
        break
      case 'pricing':
        // Pricing is single-select, so toggle on/off
        if (currentState.pricing === value) {
          removeFilter('pricing', value, preserveScroll)
        } else {
          addFilter('pricing', value, preserveScroll)
        }
        return
      case 'search':
        // Search is single-value, so just update
        updateFilters({ search: value }, preserveScroll)
        return
    }

    if (currentValues.includes(value)) {
      removeFilter(type, value, preserveScroll)
    } else {
      addFilter(type, value, preserveScroll)
    }
  }

  // Clear all filters
  const clearAllFilters = () => {
    startTransition(() => {
      router.push(config.basePath, { scroll: false })
    })
  }

  // Get filter chips for display
  const getFilterChips = (categories?: any[], tags?: any[]) => {
    const currentState = getCurrentFilterState()
    const chips: Array<{
      id: string
      label: string
      type: 'category' | 'subcategory' | 'tag' | 'filter' | 'pricing'
    }> = []

    // Category chips
    if (currentState.categories && categories) {
      currentState.categories.forEach(categorySlug => {
        const category = categories.find((c: any) => c.slug === categorySlug)
        if (category) {
          chips.push({
            id: `category-${categorySlug}`,
            label: category.name,
            type: 'category'
          })
        }
      })
    }

    // Subcategory chips
    if (currentState.subcategories && categories) {
      currentState.subcategories.forEach(subcategorySlug => {
        // Find subcategory across all categories
        for (const category of categories) {
          if (category.subcategories) {
            const subcategory = category.subcategories.find((s: any) => s.slug === subcategorySlug)
            if (subcategory) {
              chips.push({
                id: `subcategory-${subcategorySlug}`,
                label: subcategory.name,
                type: 'subcategory'
              })
              break
            }
          }
        }
      })
    }

    // Tag chips
    if (currentState.tags && tags) {
      currentState.tags.forEach(tagSlug => {
        const tag = tags.find((t: any) => t.slug === tagSlug)
        if (tag) {
          chips.push({
            id: `tag-${tagSlug}`,
            label: tag.name,
            type: 'tag'
          })
        }
      })
    }

    // Filter chips
    if (currentState.filters) {
      currentState.filters.forEach(filterKey => {
        chips.push({
          id: `filter-${filterKey}`,
          label: getFilterLabel(filterKey),
          type: 'filter'
        })
      })
    }

    // Pricing chip
    if (currentState.pricing) {
      chips.push({
        id: `pricing-${currentState.pricing}`,
        label: getPricingLabel(currentState.pricing),
        type: 'pricing'
      })
    }

    return chips
  }

  // Handle filter chip removal
  const handleFilterChipRemove = (chipId: string) => {
    const [type, ...idParts] = chipId.split('-')
    const id = idParts.join('-')

    switch (type) {
      case 'category':
        removeFilter('categories', id)
        break
      case 'subcategory':
        removeFilter('subcategories', id)
        break
      case 'tag':
        removeFilter('tags', id)
        break
      case 'filter':
        removeFilter('filters', id)
        break
      case 'pricing':
        removeFilter('pricing', id)
        break
    }
  }

  return {
    getCurrentFilterState,
    updateFilters,
    addFilter,
    removeFilter,
    toggleFilter,
    clearAllFilters,
    getFilterChips,
    handleFilterChipRemove,
    isPending
  }
}

import { formatClassification, formatPricingModel } from '../utils/format-text-stub'

// Helper functions for filter labels
function getFilterLabel(filterKey: string): string {
  const customLabels: Record<string, string> = {
    'recommended': 'Recommended',
    'featured': 'Featured'
  }
  return customLabels[filterKey] || formatClassification(filterKey)
}

function getPricingLabel(pricingKey: string): string {
  return formatPricingModel(pricingKey)
}

/**
 * Vendor-specific filter configuration
 */
export const vendorFilterConfig: FilterConfig = {
  basePath: '/vendors',
  supportedFilters: {
    categories: true,
    subcategories: true,
    tags: false,
    filters: true,
    pricing: true,
    search: true
  }
}

/**
 * Blog-specific filter configuration
 */
export const blogFilterConfig: FilterConfig = {
  basePath: '/blog',
  supportedFilters: {
    categories: true,
    subcategories: false,
    tags: true,
    filters: false,
    pricing: false,
    search: true
  }
} 