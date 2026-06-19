"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import type { DocNode, DocContent } from '../../types/doc-source'
import {
  stripFolderIndexFromPath,
  findDocNodeByPath,
  getDocAncestorNodeIds,
  DEFAULT_FOLDER_INDEX_FILE,
} from '../../utils/doc-tree-nav'
import { useDocNavigation } from './doc-navigation-context'
import { scrollElementIntoView } from '../../utils/scroll-into-view'
import { navigateSamePageHash } from '../../utils/same-page-hash-nav'

function scrollToContent() {
  const article = document.querySelector('article') as HTMLElement | null
  if (article) {
    scrollElementIntoView(article, { headerOffset: 80 })
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

export interface UseDocumentTreeConfig {
  /** API endpoint for fetching the document tree structure */
  structureEndpoint: string
  /** API endpoint for fetching document content */
  contentEndpoint: string
  /** Base route path for URL navigation (e.g., '/knowledge-base', '/data-room') */
  baseRoute: string
  /** Folder-index filename (defaults to 'README.md'). */
  folderIndexFile?: string
}

/**
 * Generic hook for document tree navigation and content fetching.
 * Drives DocViewer across all doc-source consumers.
 *
 * Client-only: structure + content fetches run in parallel on first mount.
 * No SSR pre-population — the previous SSR path required a Supabase admin
 * client (service role key) and silently fell back to client fetches on
 * envs where the key wasn't set; the parallel client fetches keep behavior
 * uniform across local + prod (latency ~= max(structure, content), not sum).
 */
export function useDocumentTree(
  config: UseDocumentTreeConfig,
  initialPath?: string,
) {
  const { structureEndpoint, contentEndpoint, baseRoute } = config
  const folderIndexFile = config.folderIndexFile ?? DEFAULT_FOLDER_INDEX_FILE

  const cleanInitialPath = stripFolderIndexFromPath(
    initialPath?.replace(/\/$/, '') || '',
    folderIndexFile,
  )

  const [structure, setStructure] = useState<DocNode[]>([])
  const [selectedPath, setSelectedPath] = useState<string>(cleanInitialPath)
  const [content, setContent] = useState<DocContent | null>(null)
  const [isLoadingStructure, setIsLoadingStructure] = useState(true)
  const [isLoadingContent, setIsLoadingContent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [isInitialized, setIsInitialized] = useState(false)
  const lastFetchedPath = useRef<string | null>(null)

  const normalizedBaseRoute = baseRoute.replace(/\/$/, '')

  const selectedPathRef = useRef(selectedPath)
  selectedPathRef.current = selectedPath

  const docNavigation = useDocNavigation()

  useEffect(() => {
    const handlePopState = () => {
      const pathname = window.location.pathname
      let pathFromUrl = ''

      if (pathname === normalizedBaseRoute || pathname === `${normalizedBaseRoute}/`) {
        pathFromUrl = ''
      } else if (pathname.startsWith(`${normalizedBaseRoute}/`)) {
        pathFromUrl = pathname.substring(`${normalizedBaseRoute}/`.length)
      }

      pathFromUrl = stripFolderIndexFromPath(pathFromUrl, folderIndexFile)

      if (pathFromUrl !== selectedPathRef.current) {
        setSelectedPath(pathFromUrl)
        if (pathFromUrl) {
          const parentPath = pathFromUrl.includes('/')
            ? pathFromUrl.substring(0, pathFromUrl.lastIndexOf('/'))
            : pathFromUrl
          setExpandedNodes(new Set(getDocAncestorNodeIds(parentPath)))
        }
        setTimeout(() => {
          scrollToContent()
        }, 150)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [normalizedBaseRoute, folderIndexFile])

  useEffect(() => {
    if (!isInitialized) {
      // Kick off the speculative content fetch IN PARALLEL with the structure
      // fetch — the two endpoints are independent and most landing pages have
      // a root README (the default folder-index). If the structure ends up
      // pointing at a different path (e.g. knowledge-base falls back to the
      // first-folder README because there's no root README), the content
      // useEffect issues the correct fetch after structure arrives — the
      // speculative result silently no-ops (the content state update gets
      // overwritten by the targeted fetch).
      const speculativeContentPath = cleanInitialPath || folderIndexFile
      lastFetchedPath.current = speculativeContentPath
      fetchContent(speculativeContentPath)
      fetchStructure()
      setIsInitialized(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized])

  useEffect(() => {
    if (selectedPath === null || selectedPath === undefined) return
    if (!structure || structure.length === 0) return

    let pathToFetch: string | null = null

    if (selectedPath === '') {
      pathToFetch = folderIndexFile
    } else {
      const node = findDocNodeByPath(selectedPath, structure)

      if (node && node.type === 'folder' && !node.hasReadme) {
        return
      }

      pathToFetch = selectedPath
      if (node && node.type === 'folder' && node.hasReadme) {
        pathToFetch = `${selectedPath}/${folderIndexFile}`
      }
    }

    if (pathToFetch === lastFetchedPath.current) {
      return
    }

    if (pathToFetch) {
      lastFetchedPath.current = pathToFetch
      fetchContent(pathToFetch)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPath, structure, folderIndexFile])

  const fetchStructure = async () => {
    try {
      setIsLoadingStructure(true)
      setError(null)

      const response = await fetch(structureEndpoint)

      if (!response.ok) {
        throw new Error('Failed to load documentation structure')
      }

      const result = await response.json()

      if (result.success && result.data) {
        setStructure(result.data)

        if (cleanInitialPath) {
          const pathForExpansion = cleanInitialPath.includes('.')
            ? cleanInitialPath.substring(0, cleanInitialPath.lastIndexOf('/'))
            : cleanInitialPath
          if (pathForExpansion) {
            setExpandedNodes(new Set(getDocAncestorNodeIds(pathForExpansion)))
          }
        } else if (result.data.length > 0) {
          const hasRootReadme = result.data.some(
            (node: DocNode) => node.type === 'file' && node.path === folderIndexFile
          )

          if (!hasRootReadme) {
            const firstNode = result.data[0]
            if (firstNode.type === 'folder') {
              setExpandedNodes(new Set([firstNode.id]))
              if (firstNode.hasReadme) {
                setSelectedPath(firstNode.path)
                window.history.replaceState({}, '', `${normalizedBaseRoute}/${firstNode.path}`)
              }
            }
          }
        }
      } else {
        setError('Failed to load documentation structure')
      }
    } catch (err) {
      console.error('Error fetching documentation structure:', err)
      setError(err instanceof Error ? err.message : 'Failed to load documentation')
    } finally {
      setIsLoadingStructure(false)
    }
  }

  const fetchContent = async (path: string) => {
    try {
      setIsLoadingContent(true)
      // Don't clear `error` here — if a previous fetch set an error and this
      // is a stale/speculative call that gets superseded, the guard below
      // returns early without writing to state. Clearing error here would
      // briefly flicker the user-visible error message.

      const response = await fetch(`${contentEndpoint}?path=${encodeURIComponent(path)}`)

      // Request-id guard: between awaits, `lastFetchedPath.current` may have
      // been bumped by a newer fetch (the structure-arrives auto-select issues
      // a more-targeted fetch while the speculative one is in flight). Bail
      // BEFORE writing to state — otherwise the late 404 of the speculative
      // fetch overwrites the targeted fetch's good content with null.
      if (path !== lastFetchedPath.current) return

      if (!response.ok) {
        if (response.status === 404) {
          const result = await response.json().catch(() => ({}))
          if (path !== lastFetchedPath.current) return
          // Landing-page silent fallback: when the user lands on the source's
          // root URL and there's no root `README.md` (knowledge-base case),
          // the speculative fetch 404s — surface an empty state instead of
          // an error banner. The structure-arrives auto-select will fire
          // a targeted fetch for the first-folder README on the next render.
          if (path === folderIndexFile && selectedPath === '') {
            setError(null)
            setContent(null)
            return
          }
          setError(result.error || 'Documentation file not found')
          setContent(null)
          return
        }
        throw new Error('Failed to load documentation content')
      }

      const result = await response.json()
      if (path !== lastFetchedPath.current) return
      setError(null)

      if (result.success && result.data) {
        if (result.redirect && result.correctPath !== undefined) {
          const correctedPath = result.correctPath
          setSelectedPath(correctedPath)
          window.history.replaceState({}, '', `${normalizedBaseRoute}/${correctedPath}`)
          setContent(result.data)
        } else {
          setContent(result.data)
        }
      } else {
        setError(result.error || 'Failed to load content')
        setContent(null)
      }
    } catch (err) {
      if (path !== lastFetchedPath.current) return
      console.error('Error fetching documentation content:', err)
      setError(err instanceof Error ? err.message : 'Failed to load content')
      setContent(null)
    } finally {
      // Only clear loading state if THIS fetch is still the active one — a
      // superseded speculative shouldn't flip the spinner off while the
      // targeted fetch is still in flight.
      if (path === lastFetchedPath.current) setIsLoadingContent(false)
    }
  }

  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }, [])

  // Structural minimum the body uses — `id`, `path`, `type`, `hasReadme`.
  // Widening from `DocNode` lets the navigation components (which carry the
  // narrower `NavigationNode` row shape) pass their own node back without the
  // cross-type `as` cast. Both DocNode and NavigationNode satisfy this.
  const selectNode = useCallback((node: Pick<DocNode, 'id' | 'path' | 'type' | 'hasReadme'>) => {
    if (node.type === 'folder') {
      setExpandedNodes(prev => {
        if (prev.has(node.id)) {
          const ancestorIds = getDocAncestorNodeIds(node.path)
          ancestorIds.pop()
          return new Set(ancestorIds)
        } else {
          return new Set(getDocAncestorNodeIds(node.path))
        }
      })

      if (node.hasReadme) {
        lastFetchedPath.current = null
        setSelectedPath(node.path)
        window.history.pushState({}, '', `${normalizedBaseRoute}/${node.path}`)
        setTimeout(() => {
          scrollToContent()
        }, 150)
      } else {
        setSelectedPath(node.path)
      }
    } else {
      const lastSlash = node.path.lastIndexOf('/')
      if (lastSlash > 0) {
        const parentPath = node.path.substring(0, lastSlash)
        setExpandedNodes(new Set(getDocAncestorNodeIds(parentPath)))
      }

      lastFetchedPath.current = null
      setSelectedPath(node.path)
      window.history.pushState({}, '', `${normalizedBaseRoute}/${node.path}`)
      setTimeout(() => {
        scrollToContent()
      }, 150)
    }
  }, [normalizedBaseRoute])

  const navigateToDoc = useCallback((path: string, options?: { expandFolder?: boolean; fromInternalLink?: boolean }) => {
    const hashIndex = path.indexOf('#')
    const anchor = hashIndex !== -1 ? path.substring(hashIndex) : ''
    const cleanPath = path.replace(/\/$/, '').split('#')[0]

    // Same-doc-different-anchor shortcut. Content is already mounted, so we
    // don't need the 300ms "wait-for-fetch" bandaid — the canonical helper
    // owns pushState + synthetic `hashchange` (so any in-doc TOC / accordion
    // bound to the URL hash re-renders) + the anchoring-proof tween in one
    // sync call. `headerOffset: 80` matches the cross-doc path below so
    // anchors land BELOW the docs sticky header on every same-doc internal
    // link click. Cross-doc nav (different cleanPath) falls through to the
    // existing fetch-then-scroll path below.
    //
    // We pass the BARE-hash form to the helper rather than reconstructing
    // a full `${normalizedBaseRoute}/${cleanPath}${anchor}` path: the
    // helper's pathname check compares against `window.location.pathname`,
    // which carries the FOLDER-INDEX-STRIPPED form (`/docs/foo` for
    // `foo/README.md`, `/docs` for the root index). Handing it `cleanPath`
    // — the raw resolved path — produces e.g. `/docs/foo/README.md` and
    // the compare fails → helper returns false → silent dead-click. The
    // bare-hash form sidesteps that entirely: the helper reconstructs
    // `pathname + search + hash` from `window.location`, so the compare
    // is trivially equal. Covers bare `#anchor` links (resolve to
    // `cleanPath=''`) AND folder-index links (`foo/README.md` resolving
    // to the current `/docs/foo`).
    // Bare-hash internal links (`[Click](#section)`) come in as
    // `path === '#section'`, so `cleanPath` becomes `''` and the naive
    // strip-then-compare misses the same-doc shortcut on every NON-root
    // doc (selectedPath is e.g. `'foo/bar'`, not `''`). For that case the
    // current doc IS the same-doc target by definition — short-circuit
    // pathForSelection to the current selection so the shortcut fires.
    const pathForSelection =
      anchor && options?.fromInternalLink && cleanPath === ''
        ? selectedPathRef.current
        : stripFolderIndexFromPath(cleanPath, folderIndexFile)
    if (
      anchor &&
      options?.fromInternalLink &&
      pathForSelection === selectedPathRef.current
    ) {
      navigateSamePageHash(anchor, { headerOffset: 80 })
      return
    }

    const scrollAfterNav = () => {
      if (anchor) {
        setTimeout(() => {
          const el = document.getElementById(anchor.substring(1))
          if (el) {
            scrollElementIntoView(el, { headerOffset: 80 })
          } else {
            scrollToContent()
          }
        }, 300)
      } else {
        setTimeout(() => {
          scrollToContent()
        }, 150)
      }
    }

    if (options?.expandFolder) {
      lastFetchedPath.current = null
      setSelectedPath(cleanPath)
      window.history.pushState({}, '', `${normalizedBaseRoute}/${cleanPath}${anchor}`)

      const pathParts = cleanPath.split('/')
      const nodeIdsToExpand: string[] = []
      let currentPath = ''

      for (const part of pathParts) {
        currentPath = currentPath ? `${currentPath}-${part}` : part
        nodeIdsToExpand.push(currentPath.toLowerCase())
      }

      setExpandedNodes(new Set(nodeIdsToExpand))

      if (options?.fromInternalLink) {
        scrollAfterNav()
      }

      setError(null)
      return
    }

    // `pathForSelection` was already computed above (inside the
    // same-doc-anchor shortcut check); reuse it here for cross-doc nav.
    const urlPath = pathForSelection

    lastFetchedPath.current = null
    setSelectedPath(pathForSelection)
    window.history.pushState({}, '', `${normalizedBaseRoute}/${urlPath}${anchor}`)

    if (options?.fromInternalLink) {
      scrollAfterNav()
    }

    const pathParts = cleanPath.split('/')
    const parentIds: string[] = []
    let currentPath = ''
    const partsToProcess = cleanPath.includes('.') ? pathParts.slice(0, -1) : pathParts

    for (const part of partsToProcess) {
      currentPath = currentPath ? `${currentPath}-${part}` : part
      parentIds.push(currentPath.toLowerCase())
    }

    if (parentIds.length > 0) {
      setExpandedNodes(new Set(parentIds))
    }
  }, [structure, normalizedBaseRoute, folderIndexFile])

  useEffect(() => {
    return docNavigation.register({
      baseRoute: normalizedBaseRoute,
      findNodeByPath: (path) => {
        const clean = stripFolderIndexFromPath(path.replace(/\/$/, '').split('#')[0], folderIndexFile)
        return findDocNodeByPath(clean, structure) ?? null
      },
      selectNode,
    })
  }, [docNavigation, normalizedBaseRoute, structure, selectNode, folderIndexFile])

  return {
    structure,
    selectedPath,
    setSelectedPath,
    content,
    isLoadingStructure,
    isLoadingContent,
    error,
    expandedNodes,
    toggleNode,
    selectNode,
    navigateToDoc,
    refetch: fetchStructure,
    setExpandedNodes,
  }
}

export type { DocNode, DocContent }
