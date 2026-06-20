"use client"

import React, { useCallback, useMemo } from "react"
import { MultiLevelNavigation, MobileNavigationDropdown } from "../navigation/multi-level-navigation"
import { PageHeading } from "../layout/page-heading"
import { PersistentSidebar, PersistentMobileDropdown } from "../persistent-filter-controls"
import { CategorySidebarSkeleton } from "../loading/page-layout-skeleton"
import { DocSearchBar, useDocSearch } from "../shared/doc-search"
import { StickySectionNav } from "../navigation/sticky-section-nav"
import { useDocumentTree } from "./use-document-tree"
import { useScrollSpy } from "./use-scroll-spy"
import { useDocNavigation } from "./doc-navigation-context"
import { findDocNodeByPath } from "../../utils/doc-tree-nav"
import type { DocContent, DocNode, DocRenderHandlers, DocSourceId, ResolveLinkResult } from "../../types/doc-source"
import { useChatRuntime } from "../../contexts/chat-runtime-context"

/** Color tokens for the doc-viewer chrome. Hub-side `DocViewer` callers share
 *  this constant; no need to override per source — the palette is intentionally
 *  uniform across knowledge-base + data-room (both use ODS dark tokens). */
export const DEFAULT_DOC_VIEWER_PALETTE = {
  background: "bg-ods-bg",
  containerBackground: "transparent",
  headerText: "text-ods-text-primary",
  primaryText: "text-ods-text-primary",
  secondaryText: "text-ods-text-secondary",
  accent: "var(--ods-accent)",
  border: "border-ods-border",
  cardBackground: "bg-ods-card",
} as const

export interface DocViewerProps {
  /**
   * Registry source id (`'openframe-docs'`, `'data-room-docs'`, …). Flowed through
   * `renderContent`'s handlers for `/api/docs/resolve-link` POSTs.
   */
  sourceId: DocSourceId

  /**
   * Render the content body. The page shell owns this — it picks the markdown
   * renderer, dispatches PDF/Figma/Sheets/file branches, etc. No renderer
   * interface in between.
   */
  renderContent: (content: DocContent, handlers: DocRenderHandlers) => React.ReactNode

  /**
   * Render the loading skeleton. Receives the selected node's `documentType`
   * (undefined while structure is still loading) so the caller can return a
   * markdown-shaped skeleton vs an embed-shaped skeleton.
   */
  renderSkeleton: (documentType: DocNode['documentType']) => React.ReactNode

  /**
   * Chat-source identifier — passed in by the page shell from server-side
   * `currentPlatform()`. Lib has no platform context; the page shell is the
   * trusted boundary that wires this. NEVER pass user input here.
   */
  chatSource: string

  title: string | React.ReactNode
  /** Override the default ODS palette. Optional — most callers should omit. */
  colorPalette?: typeof DEFAULT_DOC_VIEWER_PALETTE
  className?: string

  /** Initial doc path (URL `[...path]`). */
  docPath?: string

  /** Sidebar header copy (`'DOCUMENTATION'`, `'DATA ROOM'`). */
  sidebarLabel?: string

  /**
   * API endpoint for fetching the document tree structure. Defaults to the
   * dispatcher path `/api/docs/sources/${sourceId}/structure`. Override only
   * if hosting the viewer behind a different route.
   */
  structureEndpoint?: string
  /** Same shape as `structureEndpoint`. Defaults to `/api/docs/sources/${sourceId}/content`. */
  contentEndpoint?: string
  /** RAG-search endpoint that backs the in-source search bar (when `showAIChat`
   *  is on). Defaults to `/api/docs/search`. Override for proxy-prefix embeds —
   *  same injectability pattern as `structureEndpoint` / `contentEndpoint`. */
  searchEndpoint?: string
  /** POST internal-link resolver. The viewer threads an async `onResolveLink`
   *  into `renderContent`'s `handlers` that posts `{ link, currentPath, source }`
   *  here. Defaults to `/api/docs/resolve-link`. Override for proxy-prefix embeds —
   *  same injectability pattern as `structureEndpoint` / `contentEndpoint` /
   *  `searchEndpoint`, with `ChatRuntime.endpoints.docsResolveLinkUrl` as a
   *  runtime fallback (prop → runtime → default). */
  resolveLinkEndpoint?: string
  /** Base route path for URL navigation. */
  baseRoute: string

  /** Empty state copy when no doc is selected. */
  emptyStateText?: string

  /** Whether to render the doc-search bar (bound to chat). */
  showAIChat?: boolean

  /** Folder-index filename (default `'README.md'`). */
  folderIndexFile?: string
}

export function DocViewer(props: DocViewerProps) {
  return <DocViewerContent {...props} />
}

function DocViewerContent({
  sourceId,
  renderContent,
  renderSkeleton,
  chatSource,
  title,
  colorPalette = DEFAULT_DOC_VIEWER_PALETTE,
  className = "",
  docPath,
  sidebarLabel = "DOCUMENTATION",
  structureEndpoint,
  contentEndpoint,
  searchEndpoint,
  resolveLinkEndpoint,
  baseRoute,
  emptyStateText,
  showAIChat = false,
  folderIndexFile,
}: DocViewerProps) {
  // Default endpoints derived from sourceId. Hub callers omit the props in 99%
  // of cases; the override is for embed contexts where the doc-viewer sits
  // behind a non-standard route.
  const resolvedStructureEndpoint =
    structureEndpoint ?? `/api/docs/sources/${sourceId}/structure`
  const resolvedContentEndpoint =
    contentEndpoint ?? `/api/docs/sources/${sourceId}/content`
  // Resolve-link endpoint follows the same chain as `searchEndpoint`:
  // prop → ChatRuntime.endpoints → hub default. Null-tolerant on runtime so the
  // standard hub path keeps working without a chat-runtime provider mounted.
  const chatRuntime = useChatRuntime()
  const resolvedResolveLinkEndpoint =
    resolveLinkEndpoint ?? chatRuntime?.endpoints.docsResolveLinkUrl ?? '/api/docs/resolve-link'
  const resolveLink = useCallback(
    async (href: string, currentPath: string): Promise<ResolveLinkResult> => {
      const response = await fetch(resolvedResolveLinkEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link: href, currentPath, source: sourceId }),
      })
      if (!response.ok) {
        // Hub returns the same envelope on 4xx; on network/5xx, return a
        // synthetic failure so the renderer falls through to its broken-link
        // badge instead of throwing past the click handler.
        return { success: false, error: `Resolve failed: ${response.status}` }
      }
      const json = await response.json()
      return (json.data ?? json) as ResolveLinkResult
    },
    [resolvedResolveLinkEndpoint, sourceId],
  )
  const {
    structure,
    selectedPath,
    content,
    isLoadingStructure,
    isLoadingContent,
    error,
    expandedNodes,
    selectNode,
    toggleNode,
    navigateToDoc,
  } = useDocumentTree(
    {
      structureEndpoint: resolvedStructureEndpoint,
      contentEndpoint: resolvedContentEndpoint,
      baseRoute,
      folderIndexFile,
    },
    docPath,
  )

  const { activeSection, handleSectionClick } = useScrollSpy(content?.sections)

  const docNav = useDocNavigation()
  const docSearch = useDocSearch({
    source: chatSource,
    baseRoute,
    searchEndpoint,
    onNavigate: (path) => navigateToDoc(path, { fromInternalLink: true }),
    onInPageSwap: (path) => docNav.navigate(path),
  })

  const renderedContent = useMemo(() => {
    if (!content) return null
    return renderContent(content, {
      onInternalLinkClick: navigateToDoc,
      currentPath: selectedPath,
      sourceId,
      onResolveLink: resolveLink,
    })
  }, [content, selectedPath, renderContent, navigateToDoc, sourceId, resolveLink])

  // Selected node's documentType drives:
  //   - which skeleton the caller renders during fetch (markdown vs embed)
  //   - the article max-width + sticky-nav visibility (markdown only)
  // `undefined` documentType is treated as `'markdown'` (per the DocNode
  // discriminator's documented default).
  const selectedNodeDocType =
    selectedPath && structure.length > 0
      ? findDocNodeByPath(selectedPath, structure)?.documentType
      : undefined
  // During loading, the in-flight content's type isn't known yet — fall back
  // to the selected node's type (or markdown if neither is set).
  const activeDocType = content?.documentType ?? selectedNodeDocType
  const isMarkdownContent = !activeDocType || activeDocType === 'markdown'
  const showStickyNav = isMarkdownContent

  const stickyNavSections =
    content?.sections?.map((s) => ({ id: s.id, label: s.title })) ?? []

  const isColorValue =
    colorPalette.background.startsWith('#') ||
    colorPalette.background.startsWith('rgb') ||
    colorPalette.background.startsWith('var(')

  const bgStyle = isColorValue ? { backgroundColor: colorPalette.background } : {}
  const bgClass = !isColorValue ? colorPalette.background : ''
  const containerBgStyle =
    colorPalette.containerBackground !== 'transparent'
      ? { backgroundColor: colorPalette.containerBackground }
      : {}

  const defaultEmptyText =
    structure.length > 0
      ? 'Select a document from the sidebar to view'
      : 'No documents yet. Add content from the admin panel.'
  const resolvedEmptyText = emptyStateText || defaultEmptyText

  return (
    <section className={`${bgClass} ${className}`} style={bgStyle}>
      <div
        className="max-w-[1920px] px-6 md:px-20 py-6 md:py-10 mx-auto"
        style={containerBgStyle}
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            {typeof title === 'string' ? <PageHeading>{title}</PageHeading> : title}
          </div>

          {showAIChat && (
            <DocSearchBar
              placeholder={`Search ${sidebarLabel?.toLowerCase() || 'documents'}...`}
              query={docSearch.query}
              onQueryChange={docSearch.setQuery}
              results={docSearch.results}
              isLoading={docSearch.isLoading}
              onResultSelect={docSearch.handleResultSelect}
              showDropdown={docSearch.keepDropdownOpen}
            />
          )}

          {error && (
            <div className="flex justify-center">
              <div className="rounded-lg border bg-ods-card p-8 text-center max-w-md border-ods-border">
                <h2 className="text-xl font-semibold text-ods-text-primary">
                  Error Loading Documents
                </h2>
                <p className="mt-2 text-ods-text-secondary">{error}. Please try again later.</p>
              </div>
            </div>
          )}

          {!error && (
            <div className="flex flex-col lg:flex-row gap-6 lg:gap-10 items-start flex-1">
              <div className="w-full lg:w-[320px] lg:shrink-0">
                <div className="lg:sticky lg:top-20">
                  {isLoadingStructure ? (
                    <CategorySidebarSkeleton />
                  ) : (
                    <>
                      <PersistentMobileDropdown isLoading={false}>
                        <MobileNavigationDropdown
                          nodes={structure}
                          selectedPath={selectedPath}
                          expandedNodes={expandedNodes}
                          onNodeClick={selectNode}
                          onToggleExpand={toggleNode}
                          isLoading={false}
                          folderIndexFile={folderIndexFile}
                        />
                      </PersistentMobileDropdown>

                      <PersistentSidebar isLoading={false}>
                        <div className="hidden lg:block">
                          <div className="space-y-4">
                            <h3 className="text-[14px] font-['Azeret_Mono'] font-semibold uppercase text-ods-text-secondary tracking-[-0.02em] leading-[1.43em]">
                              {sidebarLabel}
                            </h3>
                            <MultiLevelNavigation
                              nodes={structure}
                              selectedPath={selectedPath}
                              expandedNodes={expandedNodes}
                              onNodeClick={selectNode}
                              onToggleExpand={toggleNode}
                              isLoading={false}
                              folderIndexFile={folderIndexFile}
                            />
                          </div>
                        </div>
                      </PersistentSidebar>
                    </>
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0 w-full">
                <div
                  className={`grid grid-cols-1 ${
                    (showStickyNav && stickyNavSections.length > 0) ||
                    isLoadingContent ||
                    isLoadingStructure
                      ? 'lg:grid-cols-[1fr_280px]'
                      : ''
                  } gap-8`}
                >
                  <div className={`w-full ${isMarkdownContent ? 'max-w-4xl mx-auto' : ''}`}>
                    <article className="space-y-2">
                      {(isLoadingContent || isLoadingStructure) ? (
                        renderSkeleton(selectedNodeDocType)
                      ) : !content ? (
                        <div className="text-center py-16">
                          <p className="text-xl text-ods-text-secondary">{resolvedEmptyText}</p>
                        </div>
                      ) : (
                        renderedContent
                      )}
                    </article>
                  </div>

                  {(isLoadingContent || isLoadingStructure) && (
                    <div className="hidden lg:block">
                      <div className="sticky top-24">
                        <div className="h-[14px] w-28 bg-ods-border rounded animate-pulse mb-5" />
                        <div className="space-y-0">
                          {[130, 170, 190, 220, 110, 200, 80, 100, 120, 140, 90].map((w, i) => (
                            <div
                              key={i}
                              className={`py-[13px] pl-3 border-l-2 ${
                                i === 0 ? 'border-ods-accent' : 'border-transparent'
                              }`}
                            >
                              <div
                                className="h-[13px] bg-ods-border rounded animate-pulse"
                                style={{ width: w }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {showStickyNav &&
                    content &&
                    stickyNavSections.length > 0 &&
                    !isLoadingContent && (
                      <div className="hidden lg:block">
                        <div className="sticky top-24">
                          <h3 className="text-[14px] font-['Azeret_Mono'] font-semibold uppercase text-ods-text-secondary tracking-[-0.02em] leading-[1.43em] mb-4">
                            ON THIS PAGE
                          </h3>
                          <StickySectionNav
                            sections={stickyNavSections}
                            activeSection={activeSection}
                            onSectionClick={handleSectionClick}
                            ribbonPosition="left"
                            ribbonColor="var(--ods-accent)"
                          />
                        </div>
                      </div>
                    )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
