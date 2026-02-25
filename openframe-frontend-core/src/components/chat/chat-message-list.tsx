"use client"

import { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from "react"
import { cn } from "../../utils/cn"
import { ChatMessageEnhanced } from "./chat-message-enhanced"
import { ChatMessageListSkeleton } from "./chat-message-skeleton"
import type { ChatMessageListProps } from "./types"

const BOTTOM_THRESHOLD = 30 // px from bottom to be considered "at bottom"

const ChatMessageList = forwardRef<HTMLDivElement, ChatMessageListProps>(
  ({ className, messages, dialogId, isLoading = false, isTyping = false, autoScroll = true, showAvatars = true, contentClassName, assistantType, pendingApprovals, ...props }, ref) => {
    const scrollRef = useRef<HTMLDivElement>(null)

    const isStuckRef = useRef(true)
    const touchStartYRef = useRef(0)
    const lastDialogIdRef = useRef<string | undefined>(undefined)
    const lastMessageCountRef = useRef(0)
    const rafIdRef = useRef<number | null>(null)

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
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current)
        }
      }
    }, [])

    useEffect(() => {
      if (!autoScroll) return
      const el = scrollRef.current
      if (!el) return

      const dialogChanged = dialogId !== lastDialogIdRef.current
      const prevCount = lastMessageCountRef.current
      const newCount = messages.length

      lastDialogIdRef.current = dialogId
      lastMessageCountRef.current = newCount

      if (dialogChanged) {
        isStuckRef.current = true
        scrollToBottomDeferred(el)
        return
      }

      if (newCount > prevCount || (newCount > 0 && prevCount === 0)) {
        if (prevCount === 0) {
          isStuckRef.current = true
          scrollToBottomDeferred(el)
          return
        }

        const lastMessage = messages[messages.length - 1]
        if (lastMessage?.role === 'user') {
          isStuckRef.current = true
          el.scrollTop = el.scrollHeight
        }
      }
    }, [autoScroll, messages.length, dialogId, isLoading, scrollToBottomDeferred])

    useEffect(() => {
      const el = scrollRef.current
      if (!el || !autoScroll) return

      const onWheel = (e: WheelEvent) => {
        if (e.deltaY < 0) isStuckRef.current = false
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
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD
        if (atBottom) isStuckRef.current = true
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

    useEffect(() => {
      if (!autoScroll) return
      const el = scrollRef.current
      if (!el) return

      if (isStuckRef.current) {
        el.scrollTop = el.scrollHeight
      }
    }, [autoScroll, messages])

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
