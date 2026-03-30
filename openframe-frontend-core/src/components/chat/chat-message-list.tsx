"use client"

import { useRef, useEffect, useLayoutEffect, useCallback, useImperativeHandle, forwardRef } from "react"
import { cn } from "../../utils/cn"
import { ChatMessageEnhanced } from "./chat-message-enhanced"
import { ChatMessageListSkeleton } from "./chat-message-skeleton"
import type { ChatMessageListProps } from "./types"

const BOTTOM_THRESHOLD = 30 // px from bottom to be considered "at bottom"

const ChatMessageList = forwardRef<HTMLDivElement, ChatMessageListProps>(
  ({ className, messages, dialogId, isLoading = false, isTyping = false, autoScroll = true, showAvatars = true, contentClassName, assistantType, assistantIcon, pendingApprovals, hasNextPage, isFetchingNextPage, onLoadMore, ...props }, ref) => {
    const scrollRef = useRef<HTMLDivElement>(null)
    const sentinelRef = useRef<HTMLDivElement>(null)
    const onLoadMoreRef = useRef(onLoadMore)
    onLoadMoreRef.current = onLoadMore
    const isFetchingRef = useRef(isFetchingNextPage)
    isFetchingRef.current = isFetchingNextPage
    const isStuckRef = useRef(true)
    const touchStartYRef = useRef(0)
    const rafIdRef = useRef<number | null>(null)

    // Tracks previous render state for auto-scroll decisions
    const prevRenderRef = useRef<{
      dialogId: string | undefined
      messageCount: number
      lastMessageId: string | undefined
    }>({ dialogId: undefined, messageCount: 0, lastMessageId: undefined })

    // Tracks scroll height snapshot for prepend anchoring
    const prependRef = useRef<{
      firstMessageId: string | undefined
      firstMessageContent: unknown
      scrollHeight: number
      dialogId: string | undefined
    }>({ firstMessageId: undefined, firstMessageContent: undefined, scrollHeight: 0, dialogId: undefined })

    // ResizeObserver-based post-render anchoring (for markdown mounting after prepend)
    const anchoringRef = useRef<{
      observer: ResizeObserver | null
      timeout: ReturnType<typeof setTimeout> | null
      baseline: number
    }>({ observer: null, timeout: null, baseline: 0 })

    const startAnchoringWatch = useCallback((el: HTMLDivElement) => {
      anchoringRef.current.observer?.disconnect()
      if (anchoringRef.current.timeout) clearTimeout(anchoringRef.current.timeout)

      anchoringRef.current.baseline = el.scrollHeight
      const contentEl = el.firstElementChild as HTMLElement

      const observer = new ResizeObserver(() => {
        const newHeight = el.scrollHeight
        const delta = newHeight - anchoringRef.current.baseline
        if (!anchoringRef.current.baseline || delta === 0) return
        if (isStuckRef.current) {
          el.scrollTop = el.scrollHeight
        } else {
          el.scrollTop += delta
        }
        anchoringRef.current.baseline = newHeight
      })

      if (contentEl) observer.observe(contentEl)
      anchoringRef.current.observer = observer

      anchoringRef.current.timeout = setTimeout(() => {
        observer.disconnect()
        anchoringRef.current.observer = null
        anchoringRef.current.baseline = 0
      }, 1500)
    }, [])

    const scrollToBottomDeferred = useCallback((el: HTMLDivElement) => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
      }

      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight
          rafIdRef.current = null
        })
      })
    }, [])

    useEffect(() => {
      return () => {
        if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current)
        anchoringRef.current.observer?.disconnect()
        anchoringRef.current.observer = null
        if (anchoringRef.current.timeout) clearTimeout(anchoringRef.current.timeout)
        anchoringRef.current.timeout = null
        anchoringRef.current.baseline = 0
      }
    }, [])

    useEffect(() => {
      if (!autoScroll) return
      const el = scrollRef.current
      if (!el) return

      const dialogChanged = dialogId !== prevRenderRef.current.dialogId
      const prevCount = prevRenderRef.current.messageCount
      const newCount = messages.length

      const currentLastId = messages[messages.length - 1]?.id
      const prevLastId = prevRenderRef.current.lastMessageId
      prevRenderRef.current = { dialogId, messageCount: newCount, lastMessageId: currentLastId }

      if (dialogChanged) {
        isStuckRef.current = true
        scrollToBottomDeferred(el)
        startAnchoringWatch(el)
        return
      }

      if (newCount > prevCount || (newCount > 0 && prevCount === 0)) {
        if (prevCount === 0) {
          isStuckRef.current = true
          scrollToBottomDeferred(el)
          startAnchoringWatch(el)
          return
        }

        const lastIdChanged = currentLastId !== prevLastId
        const lastMsg = messages[messages.length - 1]

        if (lastIdChanged && lastMsg?.role === 'user') {
          isStuckRef.current = true
          el.scrollTop = el.scrollHeight
        }
      }
    }, [autoScroll, messages.length, dialogId, isLoading, scrollToBottomDeferred, startAnchoringWatch])

    useEffect(() => {
      const el = scrollRef.current
      if (!el || !autoScroll) return

      const onWheel = (e: WheelEvent) => {
        if (e.deltaY < 0) {
          isStuckRef.current = false
        }
      }

      const onTouchStart = (e: TouchEvent) => {
        touchStartYRef.current = e.touches[0].clientY
      }

      const onTouchMove = (e: TouchEvent) => {
        if (e.touches[0].clientY > touchStartYRef.current + 10) {
          isStuckRef.current = false
        }
      }

      const onScroll = () => {
        prependRef.current.scrollHeight = el.scrollHeight
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD
        if (atBottom && !isStuckRef.current) {
          isStuckRef.current = true
        }
      }

      el.addEventListener('wheel', onWheel, { passive: true })
      el.addEventListener('touchstart', onTouchStart, { passive: true })
      el.addEventListener('touchmove', onTouchMove, { passive: true })
      el.addEventListener('scroll', onScroll, { passive: true })

      return () => {
        el.removeEventListener('wheel', onWheel)
        el.removeEventListener('touchstart', onTouchStart)
        el.removeEventListener('touchmove', onTouchMove)
        el.removeEventListener('scroll', onScroll)
      }
    }, [autoScroll, isLoading])

    const lastMessage = messages[messages.length - 1]
    useEffect(() => {
      if (!autoScroll) return
      const el = scrollRef.current
      if (!el) return

      if (isStuckRef.current) {
        el.scrollTop = el.scrollHeight
      }
    }, [autoScroll, lastMessage])

    useLayoutEffect(() => {
      const el = scrollRef.current
      if (!el) {
        prependRef.current = { firstMessageId: undefined, firstMessageContent: undefined, scrollHeight: 0, dialogId: prependRef.current.dialogId }
        return
      }

      const currentFirstId = messages[0]?.id
      const currentFirstContent = messages[0]?.content
      const prevFirstId = prependRef.current.firstMessageId
      const prevFirstContent = prependRef.current.firstMessageContent
      const prevHeight = prependRef.current.scrollHeight

      // Capture snapshot for next render
      prependRef.current.firstMessageId = currentFirstId
      prependRef.current.firstMessageContent = currentFirstContent
      prependRef.current.scrollHeight = el.scrollHeight

      // On dialog change: just snapshot, don't adjust (auto-scroll handles it)
      if (dialogId !== prependRef.current.dialogId) {
        prependRef.current.dialogId = dialogId
        return
      }

      if (!prevFirstId || prevHeight === 0) return

      if (currentFirstId !== prevFirstId) {
        const prevIdx = messages.findIndex(m => m.id === prevFirstId)
        if (prevIdx > 0) {
          const addedHeight = el.scrollHeight - prevHeight
          if (addedHeight > 0) {
            el.scrollTop += addedHeight
          }
          if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current)
            rafIdRef.current = null
          }
          startAnchoringWatch(el)
        }
        return
      }

      if (currentFirstId === prevFirstId && !isStuckRef.current && currentFirstContent !== prevFirstContent) {
        const addedHeight = el.scrollHeight - prevHeight
        if (addedHeight > 0) {
          el.scrollTop += addedHeight
        }
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current)
          rafIdRef.current = null
        }
        startAnchoringWatch(el)
      }
    }, [messages, dialogId, startAnchoringWatch])

    useEffect(() => {
      const scrollContainer = scrollRef.current
      const sentinelElement = sentinelRef.current
      if (!scrollContainer || !sentinelElement || !hasNextPage) return

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && !isFetchingRef.current) {
            onLoadMoreRef.current?.()
          }
        },
        { root: scrollContainer, rootMargin: '200px', threshold: 0.1 }
      )
      observer.observe(sentinelElement)
      return () => observer.disconnect()
    }, [hasNextPage, isLoading])

    useImperativeHandle(ref, () => scrollRef.current!)

    if (isLoading) {
      return (
        <ChatMessageListSkeleton
          className={className}
          showAvatars={showAvatars}
          assistantType={assistantType}
          contentClassName={contentClassName}
          messageCount={6}
        />
      )
    }

    return (
      <div className="relative flex-1 min-h-0 flex flex-col">
        <div
          ref={scrollRef}
          className={cn(
            "flex h-full w-full flex-col overflow-y-auto overflow-x-hidden flex-1",
            "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-ods-border/30 hover:scrollbar-thumb-ods-text-secondary/30",
            className
          )}
          style={{ overflowAnchor: 'none' }}
          {...props}
        >
          <div
            className={cn(
              "mx-auto flex w-full max-w-3xl flex-col pb-2 min-w-0",
              contentClassName || "px-4"
            )}
            style={{ minHeight: '100%' }}
          >
            {/* Infinite scroll sentinel */}
            {hasNextPage && (
              <div ref={sentinelRef} className="h-px" style={{ overflowAnchor: 'none' }} />
            )}
            <div className="flex-1" />
            {messages.map((message, index) => (
              <ChatMessageEnhanced
                key={message.id}
                role={message.role}
                name={message.name}
                content={message.content}
                timestamp={message.timestamp}
                isTyping={index === messages.length - 1 && isTyping && message.role === 'assistant'}
                avatar={showAvatars ? message.avatar : null}
                showAvatar={showAvatars}
                assistantType={message.assistantType || assistantType}
                assistantIcon={message.role !== 'user' ? assistantIcon : undefined}
              />
            ))}
          </div>
        </div>

        {/* Sticky Pending Approvals Section */}
        {pendingApprovals && pendingApprovals.length > 0 && (
          <div className={cn(
            "border-t border-ods-border bg-ods-bg/95 backdrop-blur-sm",
            "mx-auto w-full max-w-3xl",
            contentClassName || "px-4"
          )}>
            <ChatMessageEnhanced
              role="assistant"
              name={assistantType === 'mingo' ? 'Mingo' : 'Fae'}
              content={pendingApprovals}
              timestamp={new Date()}
              showAvatar={showAvatars}
              assistantType={assistantType}
              assistantIcon={assistantIcon}
              className="py-3"
            />
          </div>
        )}
      </div>
    )
  }
)

ChatMessageList.displayName = "ChatMessageList"

export { ChatMessageList }
