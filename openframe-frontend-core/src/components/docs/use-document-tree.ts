"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import type { DocNode, DocContent } from '../../types/doc-source'
import type { DocSourceSsrPayload } from '../../types/doc-source-ssr'
import {
  stripFolderIndexFromPath,
  findDocNodeByPath,
  getDocAncestorNodeIds,
} from '../../utils/doc-tree-nav'
import { useDocNavigation } from './doc-navigation-context'
import { scrollElementIntoView } from '../../utils/scroll-into-view'

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
 */
export function useDocumentTree(
  config: UseDocumentTreeConfig,
  initialPath?: string,
  options?: { initialSsr?: DocSourceSsrPayload | null }
) {
  const { structureEndpoint, contentEndpoint, baseRoute } = config
  const folderIndexFile = config.folderIndexFile ?? 'README.md'
  const initialSsr = options?.initialSsr

  const cleanInitialPath = stripFolderIndexFromPath(
    initialPath?.replace(/\/$/, '') || '',
    folderIndexFile,
  )

  // Pre-compute the auto-select-first-folder fallback so the initial
  // selectedPath state is correct on render 1. Doing this in a useEffect
  // (`setSelectedPath` after mount) races with the content-fetching effect
  // — first render fetches the missing root index, the late update fetches
  // the right doc, and the failed first fetch's null content can overwrite
  // the good content depending on resolution order.
  const initialSelectedPath = (() => {
    if (cleanInitialPath) return cleanInitialPath
    const ssrStructure = initialSsr?.structure
    if (!ssrStructure?.length) return ''
    const hasRootIndex = ssrStructure.some(
      (node) => node.type === 'file' && node.path === folderIndexFile,
    )
    if (hasRootIndex) return ''
    const firstNode = ssrStructure[0]
    if (firstNode?.type === 'folder' && firstNode.hasReadme) return firstNode.path
    return ''
  })()

  const [structure, setStructure] = useState<DocNode[]>(() => initialSsr?.structure ?? [])
  const [selectedPath, setSelectedPath] = useState<string>(initialSelectedPath)
  const [content, setContent] = useState<DocContent | null>(
    () => (initialSsr?.content as DocContent | null) ?? null
  )
  const [isLoadingStructure, setIsLoadingStructure] = useState(
    () => !initialSsr?.structure?.length
  )
  const [isLoadingContent, setIsLoadingContent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
    () => new Set(initialSsr?.expandedNodeIds ?? [])
  )
  const [isInitialized, setIsInitialized] = useState(false)
  const lastFetchedPath = useRef<string | null>(initialSsr?.contentStoragePath ?? null)

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
      if (!initialSsr?.structure?.length) {
        fetchStructure()
      } else if (!cleanInitialPath && initialSelectedPath) {
        // SSR provided the tree AND the useState init picked an auto-select
        // path (first folder with a folder-index). Sync the sidebar expansion
        // + URL — the content fetch already happens via the selectedPath
        // useEffect on the same render.
        const firstNode = initialSsr.structure[0]
        if (firstNode) {
          setExpandedNodes(new Set([firstNode.id]))
          window.history.replaceState({}, '', `${normalizedBaseRoute}/${initialSelectedPath}`)
        }
      }
      setIsInitialized(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, initialSsr?.structure?.length, initialSelectedPath])

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
      setError(null)

      const response = await fetch(`${contentEndpoint}?path=${encodeURIComponent(path)}`)

      if (!response.ok) {
        if (response.status === 404) {
          const result = await response.json()
          if (result.type === 'folder' && result.action === 'expand_folder') {
            setError(null)
            setExpandedNodes(new Set(getDocAncestorNodeIds(path)))
            return
          } else {
            if (path === folderIndexFile && selectedPath === '') {
              setError(null)
              setContent(null)
              return
            }
            setError(result.error || 'Documentation file not found')
            setContent(null)
            return
          }
        }
        throw new Error('Failed to load documentation content')
      }

      const result = await response.json()

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
      console.error('Error fetching documentation content:', err)
      setError(err instanceof Error ? err.message : 'Failed to load content')
      setContent(null)
    } finally {
      setIsLoadingContent(false)
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

  const selectNode = useCallback((node: DocNode) => {
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

    const pathForSelection = stripFolderIndexFromPath(cleanPath, folderIndexFile)
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
