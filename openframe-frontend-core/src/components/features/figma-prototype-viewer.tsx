"use client"

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { cn } from '../../utils/cn'
import { Badge } from '../ui/badge'
import { SectionSelector, type SectionItem } from './section-selector'

// ============================================================================
// EXACT SPECIFICATIONS - NO LEGACY COMPATIBILITY
// ============================================================================

// 1. EXACT BREAKPOINTS
const DESKTOP_BREAKPOINT = 768 // px

// 2. CONFIGURABLE CONTENT DIMENSIONS (externalized from .env.local and config)
const getContentDimensions = (config?: FigmaPrototypeViewerConfig) => {
  // Default dimensions
  const defaultMobile = { width: 343, height: 600 }
  const defaultDesktop = { width: 944, height: 600 }
  
  // Environment variables take highest priority
  const envMobileWidth = process.env.NEXT_PUBLIC_FIGMA_MOBILE_WIDTH ? parseInt(process.env.NEXT_PUBLIC_FIGMA_MOBILE_WIDTH) : null
  const envMobileHeight = process.env.NEXT_PUBLIC_FIGMA_MOBILE_HEIGHT ? parseInt(process.env.NEXT_PUBLIC_FIGMA_MOBILE_HEIGHT) : null
  const envDesktopWidth = process.env.NEXT_PUBLIC_FIGMA_DESKTOP_WIDTH ? parseInt(process.env.NEXT_PUBLIC_FIGMA_DESKTOP_WIDTH) : null
  const envDesktopHeight = process.env.NEXT_PUBLIC_FIGMA_DESKTOP_HEIGHT ? parseInt(process.env.NEXT_PUBLIC_FIGMA_DESKTOP_HEIGHT) : null
  
  // Resolve mobile dimensions (env vars > config > defaults)
  const mobileWidth = envMobileWidth ?? config?.mobileContentDimensions?.width ?? defaultMobile.width
  const mobileHeight = envMobileHeight ?? config?.mobileContentDimensions?.height ?? defaultMobile.height
  
  // Resolve desktop dimensions (env vars > config > defaults)
  const desktopWidth = envDesktopWidth ?? config?.desktopContentDimensions?.width ?? defaultDesktop.width
  const desktopHeight = envDesktopHeight ?? config?.desktopContentDimensions?.height ?? defaultDesktop.height
  
  return {
    mobile: { width: mobileWidth, height: mobileHeight },
    desktop: { width: desktopWidth, height: desktopHeight }
  } as const
}

// 3. VIEW MODES
type ViewMode = 'DESKTOP' | 'MOBILE' | 'MOBILE_TOUCH'

// 4. IFRAME STATES
type IframeState = 
  | 'INITIAL'      // Not loaded yet
  | 'LOADING'      // Loading in progress  
  | 'READY'        // Fully loaded and functional
  | 'RELOADING'    // Reloading due to device change
  | 'SLEEP_RECOVERY' // Recovering from phone sleep

// 5. UNIFIED STATE INTERFACE
interface UnifiedState {
  // Core States
  viewMode: ViewMode
  iframeState: IframeState
  
  // Device Detection
  screenWidth: number
  isTouchDevice: boolean
  
  // Scaling & Layout
  scaling: {
    scale: number
    marginX: number
    marginY: number
    scaledDimensions: { width: number, height: number }
  }
  
  // UI Control States
  showSectionSelector: boolean
  showIframe: boolean
  showSkeleton: boolean
  showTouchOverlay: boolean
  showTouchBadge: boolean
  sectionsDisabled: boolean
  
  // Navigation State
  activeSection: string
  isNavigating: boolean
  
  // Figma Integration
  isInitialized: boolean
  currentNodeId: string | null
  embedUrl: string
  iframeKey: number
}

// ============================================================================
// CORE INTERFACES
// ============================================================================

export interface FigmaPrototypeSection {
  id: string
  number: string
  title: string
  description?: string
  startingNodeId: string
  mobileStartingNodeId?: string
}

export interface FigmaPrototypeViewerConfig {
  // File configuration - can specify different files for mobile/desktop
  fileKey?: string              // Legacy: single file for both (deprecated)
  mobileFileKey?: string        // Separate mobile Figma file key
  desktopFileKey?: string       // Separate desktop Figma file key
  
  title: string
  sections: FigmaPrototypeSection[]
  className?: string
  iframeClassName?: string
  controlsClassName?: string
  activeControlClassName?: string
  defaultSectionId?: string
  height?: string
  onSectionChange?: (sectionId: string) => void
  
  // Starting points - can be overridden by environment variables
  mobileStartingPoint?: string  // Default mobile starting point
  desktopStartingPoint?: string // Default desktop starting point
  
  // Content dimensions - can be overridden by environment variables
  mobileContentDimensions?: { width: number; height: number }   // Mobile content size
  desktopContentDimensions?: { width: number; height: number }  // Desktop content size
  
  hideControls?: boolean
}

interface FigmaPrototypeViewerProps {
  config: FigmaPrototypeViewerConfig
  activeSection?: string
  onSectionClick?: (sectionId: string) => void
}

// Figma Events
type FigmaEventType = 'INITIAL_LOAD' | 'NEW_STATE' | 'PRESENTED_NODE_CHANGED'

interface FigmaEvent {
  type: FigmaEventType
  data?: {
    presentedNodeId?: string
    [key: string]: any
  }
}

interface FigmaNavigationCommand {
  type: 'NAVIGATE_TO_FRAME_AND_CLOSE_OVERLAYS'
  data: { nodeId: string }
}

// ============================================================================
// CORE CALCULATION FUNCTIONS
// ============================================================================

/**
 * Determines the current view mode based on screen size and touch capability
 */
function getViewMode(screenWidth: number, isTouchDevice: boolean): ViewMode {
  if (screenWidth >= DESKTOP_BREAKPOINT && !isTouchDevice) {
    return 'DESKTOP'
  } else if (screenWidth < DESKTOP_BREAKPOINT && !isTouchDevice) {
    return 'MOBILE'
  } else {
    return 'MOBILE_TOUCH'
  }
}

/**
 * Calculates optimal scaling and positioning for iframe content
 */
function calculateScaling(
  viewMode: ViewMode, 
  containerDimensions: { width: number, height: number },
  config?: FigmaPrototypeViewerConfig
) {
  const contentDimensions = getContentDimensions(config)
  const contentSize = viewMode === 'DESKTOP' 
    ? contentDimensions.desktop 
    : contentDimensions.mobile
    
  const scaleX = containerDimensions.width / contentSize.width
  const scaleY = containerDimensions.height / contentSize.height
  const scale = Math.min(scaleX, scaleY, 1) // Never scale up, only down
  
  // Calculate margins for centering
  const scaledWidth = contentSize.width * scale
  const scaledHeight = contentSize.height * scale
  const marginX = (containerDimensions.width - scaledWidth) / 2
  const marginY = (containerDimensions.height - scaledHeight) / 2
  
  return {
    scale,
    marginX: Math.max(marginX, 4), // Very minimal margin to reduce white space
    marginY: Math.max(marginY, 0), // Allow zero top margin to push content up
    scaledDimensions: { width: scaledWidth, height: scaledHeight }
  }
}

/**
 * Resolves the appropriate file key based on viewMode and environment variables
 */
function resolveFileKey(config: FigmaPrototypeViewerConfig, viewMode: ViewMode): string {
  // Check environment variables first (highest priority)
  if (viewMode === 'DESKTOP') {
    const envDesktopFileKey = process.env.NEXT_PUBLIC_FIGMA_DESKTOP_FILE_KEY
    if (envDesktopFileKey) return envDesktopFileKey
    
    // Fall back to config
    if (config.desktopFileKey) return config.desktopFileKey
  } else {
    const envMobileFileKey = process.env.NEXT_PUBLIC_FIGMA_MOBILE_FILE_KEY
    if (envMobileFileKey) return envMobileFileKey
    
    // Fall back to config
    if (config.mobileFileKey) return config.mobileFileKey
  }
  
  // Legacy fallback to single fileKey
  if (config.fileKey) return config.fileKey
  
  // Throw error if no file key found
  throw new Error(`No Figma file key found for ${viewMode} mode. Please set NEXT_PUBLIC_FIGMA_${viewMode}_FILE_KEY or provide ${viewMode.toLowerCase()}FileKey in config.`)
}

/**
 * Resolves the starting point node ID based on viewMode, environment variables, and config
 */
function resolveStartingPoint(config: FigmaPrototypeViewerConfig, viewMode: ViewMode, section?: FigmaPrototypeSection): string {
  // If a specific section is provided, use its starting node
  if (section) {
    if (viewMode !== 'DESKTOP' && section.mobileStartingNodeId) {
      return section.mobileStartingNodeId
    }
    return section.startingNodeId
  }
  
  // Check environment variables for default starting points (highest priority)
  if (viewMode === 'DESKTOP') {
    const envDesktopStarting = process.env.NEXT_PUBLIC_FIGMA_DESKTOP_STARTING_POINT
    if (envDesktopStarting) return envDesktopStarting
    
    // Fall back to config
    if (config.desktopStartingPoint) return config.desktopStartingPoint
  } else {
    const envMobileStarting = process.env.NEXT_PUBLIC_FIGMA_MOBILE_STARTING_POINT
    if (envMobileStarting) return envMobileStarting
    
    // Fall back to config
    if (config.mobileStartingPoint) return config.mobileStartingPoint
  }
  
  // Final fallback to first section
  const firstSection = config.sections[0]
  if (firstSection) {
    return resolveStartingPoint(config, viewMode, firstSection)
  }
  
  throw new Error(`No starting point found for ${viewMode} mode. Please set NEXT_PUBLIC_FIGMA_${viewMode}_STARTING_POINT or provide ${viewMode.toLowerCase()}StartingPoint in config.`)
}

/**
 * Generates Figma embed URL with exact parameters
 */
function generateEmbedUrl(
  config: FigmaPrototypeViewerConfig,
  viewMode: ViewMode,
  startingNodeId: string,
  clientId: string
): string {
  const fileKey = resolveFileKey(config, viewMode)
  const embedHost = typeof window !== 'undefined' 
    ? window.location.hostname 
    : 'localhost'
    
  const params = new URLSearchParams({
    'node-id': startingNodeId.replace(':', '-'),
    'client-id': clientId,
    'embed-host': embedHost,
    'hide-ui': '1',
    'hotspot-hints': '0',
    'scaling': viewMode === 'DESKTOP' ? 'scale-down-width' : 'scale-down', // Change to scale-down for mobile
    'starting-point-node-id': startingNodeId.replace(':', '-'),
    'mode': 'prototype',
    'chrome': 'DOCUMENTATION'
  })
  
  return `https://embed.figma.com/proto/${fileKey}?${params.toString()}`
}

// ============================================================================
// UNIFIED DRAWING FUNCTION
// ============================================================================

/**
 * Unified drawing function that renders all UI elements based on current state
 */
function renderUnifiedUI(state: UnifiedState, handlers: {
  onSectionClick: (sectionId: string) => void
  onTouchStart: (e: React.TouchEvent) => void
}, config: FigmaPrototypeViewerConfig, iframeRef: React.RefObject<HTMLIFrameElement>) {
  const {
    viewMode,
    showSectionSelector,
    showIframe,
    showSkeleton,
    showTouchOverlay,
    showTouchBadge,
    sectionsDisabled,
    embedUrl,
    iframeKey
  } = state

  return (
    <div className={cn(
      config.hideControls ? '' : 'grid grid-cols-1 lg:grid-cols-[296px_1fr] gap-10', 
      config.className
    )}>
      {/* Section Controls */}
      {showSectionSelector && !config.hideControls && (
        <div style={{ zIndex: 10 }}>
          <SectionSelector
            sections={config.sections.map(section => ({
              id: section.id,
              title: section.title,
              description: section.description,
              number: section.number
            } as SectionItem))}
            activeSection={state.activeSection}
            onSectionChange={handlers.onSectionClick}
            disabled={sectionsDisabled}
            className={cn('relative', config.controlsClassName)}
            buttonClassName={config.controlsClassName}
            activeButtonClassName={config.activeControlClassName}
            layout="vertical"
            minHeight={viewMode !== 'DESKTOP' ? "76px" : "96px"}
          />
        </div>
      )}

      {/* Figma Container */}
      <div 
        className={cn(
          'relative w-full rounded-lg overflow-hidden border border-ods-border',
          // viewMode === 'DESKTOP' && 'border border-ods-border',
          config.iframeClassName
        )}
        style={{ 
          height: viewMode === 'DESKTOP' 
            ? (config.height || '800px') 
            : (() => {
                const contentDimensions = getContentDimensions(config)
                const mobileHeight = contentDimensions.mobile.height
                // Use content height + some padding, but respect viewport limits
                const calculatedHeight = Math.max(mobileHeight + 100, 400) // minimum 400px
                return `${Math.min(calculatedHeight, window?.innerHeight * 0.85 || 650)}px`
              })(),
          minHeight: viewMode === 'DESKTOP' ? 'auto' : (() => {
            const contentDimensions = getContentDimensions(config)
            return `${Math.max(contentDimensions.mobile.height, 400)}px`
          })(),
          maxHeight: viewMode === 'DESKTOP' ? 'none' : (() => {
            const contentDimensions = getContentDimensions(config)
            return `${contentDimensions.mobile.height + 200 }px`
          })(),
          border: viewMode === 'DESKTOP' ? undefined : 'none'
        }}
      >
        {/* Touch Overlay - Only for MOBILE_TOUCH mode */}
        {showTouchOverlay && (
          <div
            className="absolute inset-0 w-full h-full"
            data-touch-overlay="true"
            style={{
              pointerEvents: 'auto',
              touchAction: 'pan-y pinch-zoom',
              zIndex: 2,
              background: 'transparent',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0
            }}
            onTouchStart={handlers.onTouchStart}
          />
        )}

        {/* Touch Badge - Only for MOBILE_TOUCH mode */}
        {showTouchBadge && (
          <div 
            className="absolute z-10 bottom-4 left-4"
          >
            <Badge variant="secondary" className="bg-black/70 text-white backdrop-blur-sm">
              Tap twice to click
            </Badge>
          </div>
        )}

        {/* Figma Iframe */}
        <iframe
          ref={iframeRef}
          key={iframeKey}
          src={embedUrl}
          className="border-0 w-full h-full"
          style={{ 
            background: 'transparent',
            zIndex: 1,
            display: showIframe ? 'block' : 'none',
            visibility: showIframe ? 'visible' : 'hidden',
            // Let Figma handle all scaling internally
            width: '100%',
            height: '100%',
            transform: 'none',
            // Remove any default iframe styling
            border: 'none',
            outline: 'none',
            overflow: 'hidden'
          }}
          allow="clipboard-write; clipboard-read; fullscreen"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
          title={config.title}
          loading="eager"
          {...({ fetchPriority: 'high' } as any)}
        />

        {/* Loading Skeleton */}
        {showSkeleton && (
          <div className="absolute inset-0 w-full h-full bg-ods-skeleton animate-pulse rounded-lg z-10 flex items-center justify-center">
            <div className="text-center">
              <div className="text-xl md:text-2xl font-['Azeret_Mono'] font-semibold text-ods-text-primary">
                Warming up <span className="text-[var(--ods-open-yellow-base)]">Fae</span> and <span className="text-[var(--ods-open-yellow-base)]">Mingo</span>
              </div>
              <div className="mt-2 text-sm text-ods-text-secondary">
                Loading AI Co-Pilots...
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const FigmaPrototypeViewer: React.FC<FigmaPrototypeViewerProps> = ({ 
  config,
  activeSection: externalActiveSection,
  onSectionClick: externalOnSectionClick 
}) => {
  // Environment & Client Setup
  const clientId = process.env.NEXT_PUBLIC_FIGMA_CLIENT_ID || 'UTQPwZHR9OZp68TTGPFFi5'
  const showDebugPanel = process.env.NEXT_PUBLIC_FIGMA_DEBUG === 'true'
  
  // Refs
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Device Detection State
  const [screenWidth, setScreenWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : DESKTOP_BREAKPOINT
  )
  
  // Simple, reliable touch detection
  const [isTouchDevice, setIsTouchDevice] = useState(() => {
    if (typeof window === 'undefined') return false
    // Most reliable method: check if touch events are supported
    return 'ontouchstart' in window
  })
  
  // Iframe Management State
  const [iframeState, setIframeState] = useState<IframeState>('INITIAL')
  const [iframeKey, setIframeKey] = useState(0)
  const [isInitialized, setIsInitialized] = useState(false)
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null)
  
  // Navigation State
  const [internalActiveSection, setInternalActiveSection] = useState<string>(
    config.defaultSectionId || config.sections[0]?.id || ''
  )
  const activeSection = externalActiveSection || internalActiveSection
  const [isNavigating, setIsNavigating] = useState(false)
  
  // Container Dimensions for Scaling
  const [containerDimensions, setContainerDimensions] = useState({ width: 1200, height: 800 })
  
  // Calculate Current View Mode
  const viewMode = useMemo(() => 
    getViewMode(screenWidth, isTouchDevice), 
    [screenWidth, isTouchDevice]
  )
  
  // Calculate Scaling
  const scaling = useMemo(() => 
    calculateScaling(viewMode, containerDimensions, config),
    [viewMode, containerDimensions, config]
  )
  
  // Generate Embed URL
  const embedUrl = useMemo(() => {
    try {
      const startingNodeId = resolveStartingPoint(config, viewMode)
      return generateEmbedUrl(config, viewMode, startingNodeId, clientId)
    } catch (error) {
      console.error('[FigmaPrototypeViewer] Failed to generate embed URL:', error)
      return ''
    }
  }, [config, viewMode, clientId])
  
  // Create Unified State
  const unifiedState: UnifiedState = useMemo(() => ({
    viewMode,
    iframeState,
    screenWidth,
    isTouchDevice,
    scaling,
    showSectionSelector: true,
    showIframe: iframeState === 'READY',
    showSkeleton: iframeState !== 'READY',
    showTouchOverlay: viewMode === 'MOBILE_TOUCH' && iframeState === 'READY',
    showTouchBadge: viewMode === 'MOBILE_TOUCH' && iframeState === 'READY',
    sectionsDisabled: iframeState !== 'READY' || isNavigating,
    activeSection,
    isNavigating,
    isInitialized,
    currentNodeId,
    embedUrl,
    iframeKey
  }), [
    viewMode, iframeState, screenWidth, isTouchDevice, scaling, 
    activeSection, isNavigating, isInitialized, currentNodeId, embedUrl, iframeKey
  ])
  
  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================
  
  // Window Resize Handler
  useEffect(() => {
    const handleResize = () => {
      const newWidth = window.innerWidth
      setScreenWidth(newWidth)
      
      // Update container dimensions
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setContainerDimensions({ width: rect.width, height: rect.height })
      }
    }
    
    // Initial measurement
    handleResize()
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  
  // Touch device detection is now done once at initialization for consistency
  
  // View Mode Change Handler (triggers iframe reload)
  const [lastViewMode, setLastViewMode] = useState(viewMode)
  useEffect(() => {
    if (lastViewMode !== viewMode && iframeState === 'READY') {
      console.log('[ViewMode Change]', lastViewMode, '→', viewMode)
      setIframeState('RELOADING')
      setIframeKey(prev => prev + 1)
    }
    setLastViewMode(viewMode)
  }, [viewMode, lastViewMode, iframeState])
  
  // Visibility Change Handler (phone sleep recovery)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && iframeState === 'READY') {
        console.log('[Sleep Recovery] Reloading iframe after sleep')
        setIframeState('SLEEP_RECOVERY')
        setIframeKey(prev => prev + 1)
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [iframeState])
  
  // Figma Event Handler
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://www.figma.com') return
      
      const validEvents: FigmaEventType[] = ['INITIAL_LOAD', 'NEW_STATE', 'PRESENTED_NODE_CHANGED']
      
      if (event.data?.type && validEvents.includes(event.data.type)) {
        const figmaEvent = event.data as FigmaEvent
        
        console.log('[Figma Event]', figmaEvent.type, viewMode)
        
        switch (figmaEvent.type) {
          case 'INITIAL_LOAD':
          case 'NEW_STATE':
            setIsInitialized(true)
            setIframeState('READY')
            break
            
          case 'PRESENTED_NODE_CHANGED':
            if (figmaEvent.data?.presentedNodeId) {
              setCurrentNodeId(figmaEvent.data.presentedNodeId)
              
              // Auto-sync active section if not manually navigating
              if (!isNavigating) {
                const matchingSection = config.sections.find(s => {
                  const desktopMatch = s.startingNodeId === figmaEvent.data?.presentedNodeId ||
                                    s.startingNodeId.replace(':', '-') === figmaEvent.data?.presentedNodeId
                  const mobileMatch = s.mobileStartingNodeId === figmaEvent.data?.presentedNodeId ||
                                    s.mobileStartingNodeId?.replace(':', '-') === figmaEvent.data?.presentedNodeId
                  return desktopMatch || mobileMatch
                })
                
                if (matchingSection && matchingSection.id !== activeSection) {
                  if (!externalActiveSection) {
                    setInternalActiveSection(matchingSection.id)
                  }
                  config.onSectionChange?.(matchingSection.id)
                }
              }
            }
            break
        }
      }
    }
    
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [config.sections, activeSection, isNavigating, externalActiveSection, config.onSectionChange, viewMode])
  
  // Navigation Function
  const navigateToSection = useCallback((sectionId: string) => {
    const section = config.sections.find(s => s.id === sectionId)
    if (!section || !iframeRef.current?.contentWindow || !isInitialized) {
      return
    }
    
    setIsNavigating(true)
    
    // Use resolver to get the correct node ID for this section
    const nodeId = resolveStartingPoint(config, viewMode, section)
    
    // Update active section
    if (!externalActiveSection) {
      setInternalActiveSection(sectionId)
    }
    config.onSectionChange?.(sectionId)
    
    // Send Figma command
    const command: FigmaNavigationCommand = {
      type: 'NAVIGATE_TO_FRAME_AND_CLOSE_OVERLAYS',
      data: { nodeId }
    }
    
    try {
      iframeRef.current.contentWindow.postMessage(command, 'https://www.figma.com')
      console.log('[Navigation]', sectionId, '→', nodeId, viewMode)
    } catch (error) {
      console.error('[Navigation Error]', error)
    }
    
    // Reset navigation flag
    setTimeout(() => setIsNavigating(false), 500)
  }, [config, isInitialized, viewMode, externalActiveSection])
  
  // Section Click Handler
  const handleSectionClick = useCallback((sectionId: string) => {
    const sectionsDisabled = iframeState !== 'READY' || isNavigating
    
    if (sectionId === activeSection || sectionsDisabled) {
      return
    }
    
    if (externalOnSectionClick) {
      externalOnSectionClick(sectionId)
    } else {
      navigateToSection(sectionId)
    }
  }, [activeSection, iframeState, isNavigating, externalOnSectionClick, navigateToSection])
  
  // Touch Handler for Mobile Touch Mode
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Simple approach: on any touch, disable overlay for longer to allow normal interaction,
    // then re-enable for scrolling
    const overlayElement = e.currentTarget as HTMLElement
    
    console.log('[Touch] Touch detected, allowing iframe interaction')
    
    // Disable overlay to allow touch to pass through to iframe
    overlayElement.style.pointerEvents = 'none'
    
    // Re-enable overlay after interaction window (500ms for normal human interaction)
    setTimeout(() => {
      if (overlayElement && overlayElement.style.pointerEvents === 'none') {
        overlayElement.style.pointerEvents = 'auto'
        console.log('[Touch] Overlay re-enabled for scrolling')
      }
    }, 500)
  }, [])
  
  // External Active Section Change
  useEffect(() => {
    if (externalActiveSection && externalActiveSection !== activeSection && isInitialized) {
      navigateToSection(externalActiveSection)
    }
  }, [externalActiveSection, activeSection, isInitialized, navigateToSection])
  
  // ============================================================================
  // RENDER
  // ============================================================================
  
  return (
    <div ref={containerRef}>
      {renderUnifiedUI(unifiedState, {
        onSectionClick: handleSectionClick,
        onTouchStart: handleTouchStart
      }, config, iframeRef as React.RefObject<HTMLIFrameElement>)}
      
      {/* Debug Panel */}
      {showDebugPanel && (
        <div className="mt-6 p-4 bg-ods-card border border-ods-border rounded-md">
          <h3 className="font-semibold text-ods-text-primary mb-3">🔍 Debug Panel</h3>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-ods-text-secondary">View Mode:</span>{' '}
              <span className="text-ods-text-primary font-mono">{viewMode}</span>
            </div>
            <div>
              <span className="text-ods-text-secondary">Iframe State:</span>{' '}
              <span className="text-ods-text-primary font-mono">{iframeState}</span>
            </div>
            <div>
              <span className="text-ods-text-secondary">Screen:</span>{' '}
              <span className="text-ods-text-primary">{screenWidth}px</span>
            </div>
            <div>
              <span className="text-ods-text-secondary">Touch:</span>{' '}
              <span className="text-ods-text-primary">{isTouchDevice ? 'Yes' : 'No'}</span>
            </div>
            <div>
              <span className="text-ods-text-secondary">Scale:</span>{' '}
              <span className="text-ods-text-primary">{scaling.scale.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-ods-text-secondary">Section:</span>{' '}
              <span className="text-ods-text-primary">{activeSection}</span>
            </div>
            <div className="col-span-2">
              <span className="text-ods-text-secondary">Active Node ID:</span>{' '}
              <span className="text-ods-text-primary font-mono">
                {currentNodeId || 'Not detected'}
              </span>
            </div>
          </div>
          
          <div className="mt-3 text-xs text-ods-text-secondary">
            Margins: {scaling.marginX.toFixed(0)}px × {scaling.marginY.toFixed(0)}px
          </div>
          
          {/* Additional debug info */}
          <div className="mt-3 pt-3 border-t border-ods-border">
            <div className="text-xs text-ods-text-secondary space-y-1">
              <div>
                <span className="text-ods-text-secondary">File Key:</span>{' '}
                <span className="text-ods-text-primary font-mono">
                  {(() => {
                    try {
                      return resolveFileKey(config, viewMode)
                    } catch (e) {
                      return 'Error'
                    }
                  })()}
                </span>
              </div>
              <div>
                <span className="text-ods-text-secondary">Starting Point:</span>{' '}
                <span className="text-ods-text-primary font-mono">
                  {(() => {
                    try {
                      return resolveStartingPoint(config, viewMode)
                    } catch (e) {
                      return 'Error'
                    }
                  })()}
                </span>
              </div>
              <div>
                <span className="text-ods-text-secondary">Content Dimensions:</span>{' '}
                <span className="text-ods-text-primary font-mono">
                  {(() => {
                    try {
                      const dims = getContentDimensions(config)
                      const current = viewMode === 'DESKTOP' ? dims.desktop : dims.mobile
                      return `${current.width}x${current.height}`
                    } catch (e) {
                      return 'Error'
                    }
                  })()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FigmaPrototypeViewer