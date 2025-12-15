"use client"

import React from 'react'
import { Button } from '../ui/button'
import { ArrowRight } from 'lucide-react'

interface MoreAboutButtonProps {
  onClick?: () => void
  href?: string
  className?: string
}

const MoreAboutButton: React.FC<MoreAboutButtonProps> = ({ 
  href = "/openframe",
  className = ""
}) => {
  return (
    <Button
      size="lg"
      variant="ghost"
      className={`text-[var(--ods-open-yellow-base)] flex-shrink-0 ${className}`}
      rightIcon={<ArrowRight className="w-6 h-6" />}
      href={href}
      openInNewTab={!!href}
    >
      Learn more
    </Button>
  )
}

export { MoreAboutButton }
export default MoreAboutButton