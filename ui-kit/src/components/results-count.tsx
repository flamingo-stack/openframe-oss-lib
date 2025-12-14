export interface ResultsCountProps {
  currentPage: number
  pageSize: number
  totalResults: number
  resultType: 'vendors' | 'posts'
  sortingMessage?: string
}

export function ResultsCount({
  currentPage,
  pageSize,
  totalResults,
  resultType,
  sortingMessage
}: ResultsCountProps) {
  if (totalResults === 0) {
    return null
  }

  const startIndex = ((currentPage - 1) * pageSize) + 1
  const endIndex = Math.min(currentPage * pageSize, totalResults)
  const plural = resultType === 'vendors' ? 'vendors' : 'posts'
  const singular = resultType === 'vendors' ? 'vendor' : 'post'
  const displayType = totalResults === 1 ? singular : plural

  return (
    <div className="mb-6">
      <p className="text-ods-text-secondary text-sm font-['DM_Sans']">
        {totalResults > 0 && (
          <>
            Showing {startIndex}-{endIndex} of {totalResults} {displayType}
            {sortingMessage && (
              <span className="ml-2 text-ods-accent">• {sortingMessage}</span>
            )}
          </>
        )}
      </p>
    </div>
  )
} 