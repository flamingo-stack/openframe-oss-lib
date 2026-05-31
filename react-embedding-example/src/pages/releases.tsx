import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * The lib's `ReleaseDetailPage` renders a single release by slug (the host supplies
 * the `useRelease` hook + injects the roadmap/delivery sections — see release-detail.tsx).
 * There's no public "list releases" surface, so this index just routes to a slug.
 */
export function ReleasesPage() {
  const [slug, setSlug] = useState('')
  const navigate = useNavigate()
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-ods-text-primary">Product releases</h1>
      <p className="mt-2 max-w-2xl text-sm text-ods-text-secondary">
        Enter a release slug from your hub to view it with the lib&apos;s{' '}
        <code>ReleaseDetailPage</code> (linked roadmap items render through the injected{' '}
        <code>RoadmapGrid</code>, pointed at <code>/content</code>).
      </p>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const s = slug.trim()
          if (s) navigate(`/releases/${encodeURIComponent(s)}`)
        }}
      >
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="release-slug"
          className="w-64 rounded-md border border-ods-border bg-ods-card px-3 py-1.5 text-sm text-ods-text-primary"
        />
        <button
          type="submit"
          className="rounded-md border border-ods-border bg-ods-card px-3 py-1.5 text-sm text-ods-text-primary hover:bg-ods-bg"
        >
          View →
        </button>
      </form>
    </div>
  )
}
