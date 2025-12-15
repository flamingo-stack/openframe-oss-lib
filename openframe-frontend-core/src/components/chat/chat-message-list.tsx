"use client"

import { useRef, useCallback, useLayoutEffect, useEffect, useImperativeHandle, forwardRef, type HTMLAttributes } from "react"
import { cn } from "../../utils/cn"
import { ChatMessage } from "./chat-message"
import { ChatMessageEnhanced, type MessageContent } from "./chat-message-enhanced"

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'error'
  name?: string
  content: string | MessageContent
  timestamp: Date
  avatar?: string | null
}

export interface ChatMessageListProps extends HTMLAttributes<HTMLDivElement> {
  messages: Message[]
  isTyping?: boolean
  autoScroll?: boolean
  showAvatars?: boolean
  contentClassName?: string
}

const ChatMessageList = forwardRef<HTMLDivElement, ChatMessageListProps>(
  ({ className, messages, isTyping = false, autoScroll = true, showAvatars = true, contentClassName, ...props }, ref) => {
    const scrollRef = useRef<HTMLDivElement>(null)
    const isPinnedToBottomRef = useRef(true)
    const resizeObserverRef = useRef<ResizeObserver | null>(null)
    const mutationObserverRef = useRef<MutationObserver | null>(null)
    const lastScrollHeightRef = useRef<number>(0)

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
      if (!scrollRef.current) return
      const element = scrollRef.current
      element.scrollTop = element.scrollHeight - element.clientHeight
      element.scrollTo({ top: element.scrollHeight, behavior })
    }, [])

    useLayoutEffect(() => {
      scrollToBottom('auto')
    }, [scrollToBottom])

    useEffect(() => {
      const node = scrollRef.current
      if (!node) return

      const handleScroll = () => {
        const distanceFromBottom = node.scrollHeight - (node.scrollTop + node.clientHeight)
        isPinnedToBottomRef.current = distanceFromBottom <= 50
      }

      handleScroll()
      node.addEventListener('scroll', handleScroll, { passive: true })
      return () => node.removeEventListener('scroll', handleScroll)
    }, [])

    useEffect(() => {
      if (!autoScroll || !scrollRef.current) return
      
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
      }
      
      const scrollContainer = scrollRef.current
      const contentContainer = scrollContainer.querySelector('.mx-auto.flex.w-full')
      
      if (!contentContainer) return
      
      resizeObserverRef.current = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const newHeight = entry.target.scrollHeight
          
          if (newHeight > lastScrollHeightRef.current && isPinnedToBottomRef.current) {
            scrollContainer.scrollTop = scrollContainer.scrollHeight
            
            requestAnimationFrame(() => {
              if (scrollRef.current && isPinnedToBottomRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight
              }
            })
          }
          
          lastScrollHeightRef.current = newHeight
        }
      })
      
      resizeObserverRef.current.observe(contentContainer)
      
      return () => {
        if (resizeObserverRef.current) {
          resizeObserverRef.current.disconnect()
          resizeObserverRef.current = null
        }
      }
    }, [autoScroll, messages])
    
    useLayoutEffect(() => {
      if (!autoScroll) return
      if (!scrollRef.current) return
      
      const lastMessage = messages[messages.length - 1]
      if (!lastMessage) return
      
      if (lastMessage.role !== 'assistant') return
      
      if (!isPinnedToBottomRef.current) return
      
      const scrollContainer = scrollRef.current
      const contentContainer = scrollContainer.querySelector('.mx-auto.flex.w-full')
      
      if (mutationObserverRef.current) {
        mutationObserverRef.current.disconnect()
      }
      
      scrollContainer.scrollTop = scrollContainer.scrollHeight
      
      if (contentContainer) {
        mutationObserverRef.current = new MutationObserver(() => {
          if (isPinnedToBottomRef.current && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
          }
        })
        
        mutationObserverRef.current.observe(contentContainer, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
          attributeOldValue: false,
          characterDataOldValue: false
        })
      }
      
      const performRAFScroll = (depth: number = 0) => {
        if (depth > 2) return
        
        requestAnimationFrame(() => {
          if (isPinnedToBottomRef.current && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
            
            if (depth < 1) {
              performRAFScroll(depth + 1)
            }
          }
        })
      }
      
      performRAFScroll()
      
      lastScrollHeightRef.current = scrollContainer.scrollHeight
      
      return () => {
        if (mutationObserverRef.current) {
          mutationObserverRef.current.disconnect()
          mutationObserverRef.current = null
        }
      }
    }, [autoScroll, messages[messages.length - 1]?.content])

    useLayoutEffect(() => {
      if (!autoScroll) return
      if (!scrollRef.current) return

      const lastMessage = messages[messages.length - 1]
      if (!lastMessage) return

      const shouldScroll = lastMessage.role === 'user' || isPinnedToBottomRef.current
      if (!shouldScroll) return

      const behavior: ScrollBehavior = lastMessage.role === 'user' ? 'smooth' : 'auto'
      scrollToBottom(behavior)
    }, [autoScroll, scrollToBottom, messages[messages.length - 1]?.id])

    useEffect(() => {
      if (!autoScroll) return
      if (!isPinnedToBottomRef.current) return
      scrollToBottom('smooth')
    }, [isTyping, scrollToBottom, autoScroll])

    useEffect(() => {
      return () => {
        if (resizeObserverRef.current) {
          resizeObserverRef.current.disconnect()
        }
        if (mutationObserverRef.current) {
          mutationObserverRef.current.disconnect()
        }
      }
    }, [])

    useImperativeHandle(ref, () => scrollRef.current!)
    
    return (
      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollRef}
          className={cn(
            "flex h-full w-full flex-col overflow-y-auto overflow-x-hidden",
            "[scroll-behavior:smooth]",
            "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-ods-border/30 hover:scrollbar-thumb-ods-text-secondary/30",
            className
          )}
          {...props}
        >
          <div className={cn("mx-auto flex w-full max-w-3xl flex-col gap-1 pt-8 min-w-0", contentClassName || "px-12")} style={{ minHeight: '100%' }}>
            <div className="flex-1" />
            {messages.map((message, index) => {
              const useEnhanced = Array.isArray(message.content) || message.role === 'assistant'
              
              if (useEnhanced) {
                return (
                  <ChatMessageEnhanced
                    key={message.id}
                    role={message.role}
                    name={message.name}
                    content={message.content}
                    timestamp={message.timestamp}
                    isTyping={index === messages.length - 1 && isTyping && message.role === 'assistant'}
                    avatar={showAvatars ? message.avatar : null}
                    showAvatar={showAvatars}
                  />
                )
              } else {
                return (
                  <ChatMessage
                    key={message.id}
                    role={message.role}
                    name={message.name}
                    content={typeof message.content === 'string' ? message.content : ''}
                    timestamp={message.timestamp}
                    isTyping={index === messages.length - 1 && isTyping && message.role === 'assistant'}
                    avatar={showAvatars ? message.avatar : null}
                    showAvatar={showAvatars}
                  />
                )
              }
            })}
          </div>
        </div>
      </div>
    )
  }
)

ChatMessageList.displayName = "ChatMessageList"

export { ChatMessageList }