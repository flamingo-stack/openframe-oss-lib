"use client"

import * as React from "react"
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
  useHover,
  safePolygon,
  arrow,
} from '@floating-ui/react'
import { cn } from "../../utils/cn"

interface FloatingTooltipProps {
  content: React.ReactNode
  children: React.ReactNode
  side?: "top" | "right" | "bottom" | "left"
  className?: string
  delayDuration?: number
}

// Parse colored text markup like [YELLOW]text[/YELLOW] into JSX
function parseColoredText(text: string): React.ReactNode {
  if (typeof text !== 'string') return text;

  const parts: React.ReactNode[] = []
  let lastIndex = 0
  
  // Regex to match [COLOR]text[/COLOR] patterns
  const colorRegex = /\[([A-Z]+)\](.*?)\[\/\1\]/g
  let match
  let keyIndex = 0

  while ((match = colorRegex.exec(text)) !== null) {
    // Add text before the colored part
    if (match.index > lastIndex) {
      const beforeText = text.slice(lastIndex, match.index)
      parts.push(<span key={`text-${keyIndex++}`}>{beforeText}</span>)
    }
    
    // Add colored text
    const color = match[1].toLowerCase()
    const coloredText = match[2]
    
    // Map colors to ODS CSS classes using correct Tailwind class names
    const colorClass = color === 'yellow' ? 'text-ods-accent' : 
                      color === 'green' ? 'text-ods-success' :
                      color === 'red' ? 'text-ods-error' :
                      color === 'blue' ? 'text-ods-info' :
                      color === 'pink' ? 'text-ods-accent' :
                      color === 'cyan' ? 'text-ods-info' :
                      'text-ods-accent' // Default to ODS accent
    
    parts.push(
      <span key={`color-${keyIndex++}`} className={cn("font-semibold", colorClass)}>
        {coloredText}
      </span>
    )
    
    lastIndex = match.index + match[0].length
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    const remainingText = text.slice(lastIndex)
    parts.push(<span key={`text-${keyIndex++}`}>{remainingText}</span>)
  }
  
  return parts.length > 0 ? <>{parts}</> : text
}

export function FloatingTooltip({ 
  content, 
  children, 
  side = "right", 
  className,
  delayDuration = 0 
}: FloatingTooltipProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const arrowRef = React.useRef<HTMLDivElement>(null)

  const { refs, floatingStyles, context, placement, middlewareData } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: side,
    middleware: [
      offset(12),
      flip({
        fallbackAxisSideDirection: "start",
        crossAxis: false,
        padding: 8,
      }),
      shift({ padding: 8 }),
      arrow({ element: arrowRef }),
    ],
    whileElementsMounted: autoUpdate,
  })

  const hover = useHover(context, {
    move: false,
    delay: { open: delayDuration, close: 0 },
    handleClose: safePolygon(),
  })
  const dismiss = useDismiss(context)
  const role = useRole(context, { role: "tooltip" })

  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    dismiss,
    role,
  ])

  // Parse content if it's a string with color markup
  const parsedContent = React.useMemo(() => {
    if (typeof content === 'string') {
      return parseColoredText(content)
    }
    return content
  }, [content])

  // Calculate arrow position
  const { x: arrowX, y: arrowY } = middlewareData.arrow ?? {}
  
  const staticSide = {
    top: 'bottom',
    right: 'left',
    bottom: 'top',
    left: 'right',
  }[placement.split('-')[0]]

  return (
    <>
      <div ref={refs.setReference} {...getReferenceProps()}>
        {children}
      </div>
      <FloatingPortal>
        {isOpen && (
          <div
            ref={refs.setFloating}
            style={{
              ...floatingStyles,
              zIndex: 2147483647,
            }}
            {...getFloatingProps()}
            className={cn(
              // ODS Design System tooltip styling
              "max-w-xs overflow-hidden rounded-md",
              "bg-ods-card border border-ods-border",
              "px-3 py-2.5 text-sm leading-relaxed text-ods-text-primary",
              "whitespace-pre-line",
              // ODS shadows for proper elevation
              "shadow-[var(--shadow-md)]",
              className
            )}
          >
            {parsedContent}
            {/* Arrow element */}
            <div
              ref={arrowRef}
              style={{
                left: arrowX != null ? `${arrowX}px` : '',
                top: arrowY != null ? `${arrowY}px` : '',
                ...(staticSide && { [staticSide as string]: '-4px' }),
              }}
              className={cn(
                "absolute w-2 h-2 rotate-45",
                "bg-ods-card border-ods-border",
                {
                  'border-r border-b': staticSide === 'left',
                  'border-l border-b': staticSide === 'right',
                  'border-t border-r': staticSide === 'bottom',
                  'border-b border-l': staticSide === 'top',
                }
              )}
            />
          </div>
        )}
      </FloatingPortal>
    </>
  )
}