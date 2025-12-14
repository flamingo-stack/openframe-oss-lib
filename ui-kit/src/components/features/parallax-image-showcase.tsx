"use client"

import React, { useEffect, useState, useRef } from 'react'
import { motion, useScroll, useTransform, useMotionValue, useSpring } from 'framer-motion'

interface ParallaxImageShowcaseProps {
  images: {
    src: string
    alt: string
    position: 'left' | 'center' | 'right'
  }[]
  className?: string
  layout?: 'non-boxed' | 'boxed' | 'grid' // New layout prop
  logoElement?: React.ReactNode // Custom logo for boxed layout
  intensity?: number // Animation intensity (used for grid layout)
  shadow?: boolean // Add shadow to images (used for grid layout)
}

export const ParallaxImageShowcase: React.FC<ParallaxImageShowcaseProps> = ({ 
  images, 
  className = '', 
  layout = 'non-boxed',
  logoElement,
  intensity,
  shadow = false
}) => {
  // ANIMATION INTENSITY CONTROL
  // 0.1 = very gentle, 1 = normal, 5 = aggressive, 10 = super aggressive
  const INTENSITY = intensity || 1 // Use provided intensity or default to 1
  
  // Scroll animation - works everywhere on the page
  const { scrollY } = useScroll()
  
  // Mouse animation - works globally
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  
  // Smooth spring for mouse
  const springConfig = { stiffness: 100, damping: 30 }
  const mouseXSpring = useSpring(mouseX, springConfig)
  const mouseYSpring = useSpring(mouseY, springConfig)
  
  // Track component position for global mouse calculations
  const [componentRect, setComponentRect] = useState<DOMRect | null>(null)
  const componentRef = useRef<HTMLDivElement>(null)
  
  // Update component position on mount and resize
  useEffect(() => {
    const updateRect = () => {
      if (componentRef.current) {
        setComponentRect(componentRef.current.getBoundingClientRect())
      }
    }
    
    updateRect()
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect)
    
    return () => {
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect)
    }
  }, [])
  
  // Global mouse tracking
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!componentRect) return
      
      const centerX = componentRect.left + componentRect.width / 2
      const centerY = componentRect.top + componentRect.height / 2
      const x = (e.clientX - centerX) / componentRect.width
      const y = (e.clientY - centerY) / componentRect.height
      
      // Clamp values to reasonable range
      const clampedX = Math.max(-1, Math.min(1, x))
      const clampedY = Math.max(-1, Math.min(1, y))
      
      mouseX.set(clampedX * 20)
      mouseY.set(clampedY * 20)
    }
    
    window.addEventListener('mousemove', handleGlobalMouseMove)
    
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove)
    }
  }, [componentRect, mouseX, mouseY])
  
  // SCROLL TRANSFORMS - Values multiplied by intensity
  const scrollX = useTransform(scrollY, [0, 1000], [0, 5 * INTENSITY])
  const scrollY_ = useTransform(scrollY, [0, 1000], [0, -10 * INTENSITY])
  const scrollRotate = useTransform(scrollY, [0, 1000], [0, 0.5 * INTENSITY])
  
  // MOUSE TRANSFORMS - Values multiplied by intensity
  const mouseTransformX = useTransform(mouseXSpring, [-20, 20], [-2 * INTENSITY, 2 * INTENSITY])
  const mouseTransformY = useTransform(mouseYSpring, [-20, 20], [-2 * INTENSITY, 2 * INTENSITY])
  const mouseRotate = useTransform(mouseXSpring, [-20, 20], [-0.3 * INTENSITY, 0.3 * INTENSITY])
  
  // COMBINE scroll and mouse - same for all images
  const x = useTransform(
    [scrollX, mouseTransformX],
    ([s, m]) => (s as number) + (m as number)
  )
  const y = useTransform(
    [scrollY_, mouseTransformY],
    ([s, m]) => (s as number) + (m as number)
  )
  const rotate = useTransform(
    [scrollRotate, mouseRotate],
    ([s, m]) => (s as number) + (m as number)
  )
  
  // Get images by position
  const leftImage = images.find(img => img.position === 'left')
  const centerImage = images.find(img => img.position === 'center')
  const rightImage = images.find(img => img.position === 'right')
  
  // Grid Layout: Simple 3-column grid with gentler animations
  if (layout === 'grid') {
    // Gentler transforms for grid layout - only vertical movement
    const scrollY_Grid = useTransform(scrollY, [0, 1000], [0, -3 * INTENSITY])
    const scrollRotateGrid = useTransform(scrollY, [0, 1000], [0, 0.05 * INTENSITY])
    
    const mouseTransformYGrid = useTransform(mouseYSpring, [-20, 20], [-1 * INTENSITY, 1 * INTENSITY])
    const mouseRotateGrid = useTransform(mouseXSpring, [-20, 20], [-0.03 * INTENSITY, 0.03 * INTENSITY])
    
    const yGrid = useTransform(
      [scrollY_Grid, mouseTransformYGrid],
      ([s, m]) => (s as number) + (m as number)
    )
    const rotateGrid = useTransform(
      [scrollRotateGrid, mouseRotateGrid],
      ([s, m]) => (s as number) + (m as number)
    )
    
    return (
      <div 
        ref={componentRef}
        className={`relative w-full h-full flex items-center ${className}`}
      >
        <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Image #1 - Left */}
          {leftImage && (
            <motion.div
              className="relative w-full"
              style={{
                y: yGrid,
                rotate: rotateGrid,
              }}
            >
              <img
                src={leftImage.src}
                alt={leftImage.alt}
                className="w-full h-auto object-contain"
                style={shadow ? { boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)' } : {}}
              />
            </motion.div>
          )}
          
          {/* Image #2 - Center */}
          {centerImage && (
            <motion.div
              className="relative w-full"
              style={{
                y: yGrid,
                rotate: rotateGrid,
              }}
            >
              <img
                src={centerImage.src}
                alt={centerImage.alt}
                className="w-full h-auto object-contain"
                style={shadow ? { boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)' } : {}}
              />
            </motion.div>
          )}
          
          {/* Image #3 - Right */}
          {rightImage && (
            <motion.div
              className="relative w-full"
              style={{
                y: yGrid,
                rotate: rotateGrid,
              }}
            >
              <img
                src={rightImage.src}
                alt={rightImage.alt}
                className="w-full h-auto object-contain"
                style={shadow ? { boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)' } : {}}
              />
            </motion.div>
          )}
        </div>
      </div>
    )
  }
  
  // Boxed Layout: Clean two-row grid structure with overlaps
  if (layout === 'boxed') {
    return (
      <div 
        ref={componentRef}
        className={`relative w-full h-full overflow-hidden ${className}`}
      >
        {/* Row 1: Logo Component */}
        {logoElement && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 scale-50">
            {logoElement}
          </div>
        )}
        
        {/* Row 2: Two images with overlaps and margin from row 1 */}
        <div className="absolute top-32 inset-x-0 h-80">
          {/* Left half: Image overlaps to the left */}
          {leftImage && (
            <motion.div
              className="absolute left-20 lg:w-1/2 w-full h-full z-10"
              style={{ x: x, y: y, rotate: rotate }}
            >
              <img
                src={leftImage.src}
                alt={leftImage.alt}
                className="w-full h-full object-left object-top object-cover ods-card/50 border border-ods-border"
              />
              <div className="absolute inset-0 shadow-2xl" />
            </motion.div>
          )}
          
          {/* Right half: Image overlaps to the right */}
          {centerImage && (
            <motion.div
              className="absolute top-20 right-20 lg:w-1/2 w-full h-full z-20"
              style={{ x: x, y: y, rotate: rotate }}
            >
              <img
                src={centerImage.src}
                alt={centerImage.alt}
                className="w-full h-full object-left object-top object-cover ods-card/50 border border-ods-border"
              />
              <div className="absolute inset-0 shadow-2xl" />
            </motion.div>
          )}
        </div>
      </div>
    )
  }
  
  // Non-Boxed Layout (original implementation)
  return (
    <div 
      ref={componentRef}
      className={`relative w-full h-full ${className}`}
    >
      {/* Image #3 - Behind all - z-index 1 */}
      {rightImage && (
        <motion.div
          className="absolute z-[1] 
            w-[80%] h-[60%] top-[5%] right-[5%]
            lg:w-[120%] lg:h-[85%] lg:top-[-10%] lg:right-[-15%]"
          style={{
            x: x,
            y: y,
            rotate: rotate,
          }}
        >
          <img
            src={rightImage.src}
            alt={rightImage.alt}
            className="w-full h-full object-contain"
          />
        </motion.div>
      )}
      
      {/* Image #2 - Middle layer - z-index 2 */}
      {centerImage && (
        <motion.div
          className="absolute z-[2] 
            w-[75%] h-[55%] bottom-[10%] right-[0%]
            lg:w-[100%] lg:h-[80%] lg:bottom-[-15%] lg:right-[-20%]"
          style={{
            x: x,
            y: y,
            rotate: rotate,
          }}
        >
          <img
            src={centerImage.src}
            alt={centerImage.alt}
            className="w-full h-full object-contain"
          />
        </motion.div>
      )}
      
      {/* Image #1 - On top - z-index 3 */}
      {leftImage && (
        <motion.div
          className="absolute z-[3] 
            w-[85%] h-[65%] top-[10%] left-[-5%]
            lg:w-[110%] lg:h-[90%] lg:top-[0%] lg:left-[-25%]"
          style={{
            x: x,
            y: y,
            rotate: rotate,
          }}
        >
          <img
            src={leftImage.src}
            alt={leftImage.alt}
            className="w-full h-full object-contain"
          />
        </motion.div>
      )}
    </div>
  )
}