import { cn } from '../../utils'
import { HeaderConfig } from '../../types/navigation'

export interface HeaderSkeletonProps {
  config?: HeaderConfig
}

export function HeaderSkeleton({ config }: HeaderSkeletonProps) {
  const showNavigation = config?.navigation && config.navigation.items.length > 0
  const showActions = config?.actions?.right && config.actions.right.length > 0
  const showMobileMenu = config?.mobile?.enabled
  const isAdminHeader = config?.className?.includes('admin')
  
  return (
    <div className="sticky top-0 z-40 w-full">
      <header 
        className={cn(
          "w-full flex items-center justify-between", 
          "bg-ods-card border-b border-ods-border backdrop-blur-sm",
          "px-6 py-3",
          "transition-opacity duration-300 ease-in-out",
          config?.className
        )}
      >
        {/* Left: Logo */}
        <div className="flex items-center justify-start flex-shrink-0">
          {isAdminHeader && config?.actions?.left && (
            <div className="mr-4">
              <div className="h-10 w-10 bg-ods-border rounded animate-pulse" />
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-ods-border rounded animate-pulse" />
            <div className="h-6 w-24 bg-ods-border rounded animate-pulse" />
          </div>
        </div>

        {/* Center: Navigation */}
        {showNavigation && (
          <nav className={cn(
            "hidden md:flex items-center gap-2",
            config?.navigation?.position === 'center' && "absolute left-1/2 transform -translate-x-1/2",
            config?.navigation?.position === 'right' && "ml-auto mr-4"
          )}>
            {/* Navigation skeleton items */}
            <div className="h-10 w-20 bg-ods-border rounded animate-pulse" />
            <div className="h-10 w-28 bg-ods-border rounded animate-pulse" />
            <div className="h-10 w-24 bg-ods-border rounded animate-pulse" />
          </nav>
        )}

        {/* Right: Actions */}
        <div className="flex items-center justify-end gap-4 flex-shrink-0">
          {/* Desktop Actions */}
          {showActions && (
            <div className="hidden md:flex items-center gap-4">
              {/* Profile/Sign Up button skeleton */}
              <div className="h-10 w-24 bg-ods-border rounded animate-pulse" />
            </div>
          )}

          {/* Mobile Menu Toggle */}
          {showMobileMenu && (
            <div className="md:hidden h-10 w-10 bg-ods-border rounded animate-pulse" />
          )}
        </div>
      </header>
    </div>
  )
}