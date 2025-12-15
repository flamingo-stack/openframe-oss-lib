"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Pagination } from "./pagination"

interface UnifiedPaginationProps {
  currentPage: number
  totalPages: number
  onPageChange?: (page: number) => void
  className?: string
}

export function UnifiedPagination({ 
  currentPage, 
  totalPages, 
  onPageChange,
  className = "mt-8 flex justify-center w-full"
}: UnifiedPaginationProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const handlePageChange = (page: number) => {
    // Preserve current scroll position
    const currentScrollY = window.scrollY
    
    // Call the callback to update local state (prevents reload)
    if (onPageChange) {
      onPageChange(page)
    }
    
    // Update URL for bookmarking without navigation
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", page.toString())
    
    // Update URL without navigation (for bookmarking support)
    const newUrl = `${pathname}?${params.toString()}`
    window.history.replaceState(null, '', newUrl)
    
    // Restore scroll position after a brief delay to allow content to render
    setTimeout(() => {
      window.scrollTo({
        top: currentScrollY,
        behavior: 'instant' // Instant to prevent any scroll animation
      })
    }, 0)
  }

  // Don't render pagination if there's only one page
  if (totalPages <= 1) return null

  return (
    <div className={className}>
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </div>
  )
} 