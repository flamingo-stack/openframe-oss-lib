"use client"

import { useRef, useCallback, useLayoutEffect, useEffect, useImperativeHandle, forwardRef } from "react"
import { cn } from "../../utils/cn"
import { ChatMessageEnhanced } from "./chat-message-enhanced"
import { ChatMessageListSkeleton } from "./chat-message-skeleton"
import type { ChatMessageListProps, Message } from "./types"

const ChatMessageList = forwardRef<HTMLDivElement, ChatMessageListProps>(
  ({ className, messages, dialogId, isLoading = false, isTyping = false, autoScroll = true, showAvatars = true, contentClassName, assistantType, pendingApprovals, ...props }, ref) => {
    const scrollRef = useRef<HTMLDivElement>(null)
    const lastMessageCountRef = useRef(0)
    const lastDialogIdRef = useRef<string | undefined>(dialogId)
    const userScrolledAwayRef = useRef(false)

    const isAtBottom = useCallback(() => {
      if (!scrollRef.current) return false
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
      return scrollHeight - scrollTop - clientHeight < 5
    }, [])

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
      if (!autoScroll) return
      
      const tryScroll = () => {
        if (!scrollRef.current) {
          requestAnimationFrame(tryScroll)
          return
        }
        
        const element = scrollRef.current
        element.scrollTo({
          top: element.scrollHeight,
          behavior
        })
      }
      
      tryScroll()
    }, [autoScroll])

    useEffect(() => {
      const element = scrollRef.current
      if (!element || !autoScroll) return

      let scrollTimeout: NodeJS.Timeout
      const handleUserScroll = () => {
        clearTimeout(scrollTimeout)
        scrollTimeout = setTimeout(() => {
          const atBottom = isAtBottom()
          
          if (!atBottom) {
            userScrolledAwayRef.current = true
          } else {
            userScrolledAwayRef.current = false
          }
        }, 50)
      }

      element.addEventListener('scroll', handleUserScroll, { passive: true })

      const contentContainer = element.querySelector('.mx-auto.flex.w-full')
      if (contentContainer) {
        const mutationObserver = new MutationObserver(() => {
          if (!userScrolledAwayRef.current) {
            requestAnimationFrame(() => {
              scrollToBottom('auto')
            })
          }
        })

        mutationObserver.observe(contentContainer, {
          childList: true,
          subtree: true,
          characterData: true
        })

        return () => {
          element.removeEventListener('scroll', handleUserScroll)
          mutationObserver.disconnect()
        }
      }

      return () => {
        element.removeEventListener('scroll', handleUserScroll)
      }
    }, [autoScroll, scrollToBottom, isAtBottom])

    useEffect(() => {
      if (!autoScroll) return

      const currentMessageCount = messages.length
      const messageCountChanged = currentMessageCount !== lastMessageCountRef.current
      const dialogChanged = dialogId !== lastDialogIdRef.current

      if (dialogChanged) {
        lastDialogIdRef.current = dialogId
        lastMessageCountRef.current = currentMessageCount
        userScrolledAwayRef.current = false
        
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            scrollToBottom('auto')
          })
        })
        return
      }

      if (messageCountChanged) {
        lastMessageCountRef.current = currentMessageCount
        const lastMessage = messages[messages.length - 1]
        
        if (lastMessage?.role === 'user' || !userScrolledAwayRef.current) {
          scrollToBottom(lastMessage?.role === 'user' ? 'smooth' : 'auto')
        }
        return
      }

      if (isTyping && !isLoading) {
        if (!userScrolledAwayRef.current) {
          scrollToBottom('smooth')
        }
      }
    }, [autoScroll, messages.length, dialogId, isTyping, isLoading, scrollToBottom, messages])

    useLayoutEffect(() => {
      if (autoScroll && !isLoading) {
        scrollToBottom('auto')
        lastMessageCountRef.current = messages.length
        lastDialogIdRef.current = dialogId
      }
    }, [autoScroll, scrollToBottom, isLoading, messages.length, dialogId])

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
            "[scroll-behavior:smooth]",
            "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-ods-border/30 hover:scrollbar-thumb-ods-text-secondary/30",
            className
          )}
          {...props}
        >
          <div className={cn("mx-auto flex w-full max-w-3xl flex-col pb-2 min-w-0", contentClassName || "px-4")} style={{ minHeight: '100%' }}>
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