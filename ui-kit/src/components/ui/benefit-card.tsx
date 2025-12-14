import React from 'react'
import { cn } from '../../utils'

interface BenefitCardProps {
  icon?: React.ReactNode
  title: string
  description: string
  variant?: 'default' | 'dark' | 'auth-figma'
  className?: string
}

export const BenefitCard: React.FC<BenefitCardProps> = ({
  icon,
  title,
  description,
  variant = 'default',
  className = ''
}) => {
  const getBaseStyles = (variant: string) => {
    const gap = variant === 'auth-figma' ? 'gap-4' : 'gap-2'
    return `flex ${gap} items-start justify-start relative`
  }
  
  const variantStyles = {
    default: {
      container: "bg-ods-bg p-2 md:p-4",
      title: "font-body font-bold text-body-md md:text-body-lg text-ods-text-primary",
      description: "font-body font-medium text-body-sm md:text-body-md text-ods-text-secondary"
    },
    dark: {
      container: "bg-transparent p-0 shadow-[0px_48px_80px_0px_rgba(0,0,0,0.24)]",
      title: "font-mono font-semibold text-heading-4 leading-[40px] text-ods-text-primary tracking-[-0.64px]",
      description: "font-body font-medium text-body-lg leading-6 text-ods-text-tertiary"
    },
    'auth-figma': {
      container: "bg-transparent p-6",
      title: "font-body font-bold text-[18px] text-ods-text-primary leading-6 tracking-[-0.36px]",
      description: "font-body font-medium text-[18px] text-ods-text-secondary leading-6"
    }
  }
  
  const styles = variantStyles[variant]
  
  return (
    <div className={cn(
      getBaseStyles(variant),
      styles.container,
      className
    )}>
      {icon && (
        <div>
          {icon}
        </div>
      )}
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <h3 className={cn(
          styles.title
        )}>
          {title}
        </h3>
        <p className={cn(
          styles.description
        )}>
          {description}
        </p>
      </div>
    </div>
  )
}

interface BenefitCardGridProps {
  children: React.ReactNode
  className?: string
  columns?: 2 | 3 | 4 // Support 2, 3, or 4 columns
}

export const BenefitCardGrid: React.FC<BenefitCardGridProps> = ({
  children,
  className = '',
  columns = 2
}) => {
  const childrenArray = React.Children.toArray(children)

  const gridClass = columns === 4
    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
    : columns === 3
    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
    : 'flex flex-col md:flex-row'

  return (
    <div className={cn(
      "bg-ods-card rounded-lg shadow-ods-card border border-ods-border overflow-hidden",
      gridClass,
      className
    )}>
      {childrenArray.map((child, index) => {
        const totalItems = childrenArray.length
        const isLastItem = index === totalItems - 1

        // Dynamic border logic based on columns
        let borderClass = ''
        if (columns === 4) {
          // 4-column grid borders
          const isLastInRow = (index + 1) % 4 === 0
          const isInLastRow = index >= totalItems - 4
          borderClass = cn(
            !isLastInRow && 'md:border-r border-ods-border',
            !isInLastRow && 'border-b md:border-b lg:border-b-0',
            index < 2 && 'lg:border-b-0'
          )
        } else {
          // Original 2-3 column logic
          borderClass = isLastItem
            ? 'border-b-0'
            : 'border-b md:border-b-0 md:border-r border-ods-border'
        }

        return React.cloneElement(child as React.ReactElement<any>, {
          key: index,
          className: borderClass
        })
      })}
    </div>
  )
}