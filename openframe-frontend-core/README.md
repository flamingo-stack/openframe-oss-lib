# @flamingo/ui-kit

A shared design system package for all Flamingo platforms (OpenMSP, OpenFrame, Admin Hub, Flamingo Website, and more).

## Overview

This is a **source-only** TypeScript package that provides:
- 🎨 **UI Components** - Built on Radix UI primitives with consistent styling
- 🎯 **Platform-Aware Theming** - Automatically adapts based on `NEXT_PUBLIC_APP_TYPE`
- 🪝 **Shared Hooks** - Reusable React hooks for common functionality
- 🛠️ **Utilities** - Helper functions and utilities
- 🎭 **Icons** - Shared icon components
- 📱 **Responsive Design** - Mobile-first, accessibility-focused components
- ✅ **Zero TypeScript Errors** - Fully type-safe with comprehensive error resolution
- 🎊 **Toast System** - Reliable notifications with proper positioning and stacking
- 🔘 **Button System** - Complete button variants with proper text visibility
- 💬 **Tooltip System** - Radix-based tooltips with proper z-index management
- 🎯 **Header Z-Index** - Fixed layering for headers, sidebars, and dropdowns
- 🔄 **Configuration-Driven** - Platform-specific UI via configuration objects
- 📊 **Loading Standards** - Consistent skeleton screens and loading states
- 🎨 **BenefitCard Component** - Reusable feature/benefit display cards
- 🖼️ **OG Link Preview** - Smart fallback system for article previews with priority rendering
- 🧭 **Sticky Navigation** - Smooth scrolling section navigation with native browser APIs
- 💀 **Loading Skeletons** - Comprehensive skeleton components preventing double-loading issues
- 🔗 **Button onClick Fix** - Proper onClick support with href for dropdown menu closing
- 💰 **Investors System** - Complete CRUD with modal-based admin and Supabase integration
- 🎫 **Access Code System** - Complete client utilities for cohort-based early access management with React hooks and server-side validation ✅
- 🎬 **ParallaxImageShowcase** - Advanced parallax effects with global mouse tracking, scroll animations, and OpenMSP layout variant
  - **Default Layout**: Three-layer depth parallax for hero sections
  - **OpenMSP Layout**: Two-row structure (logo + images) with edge positioning
  - **Motion Integration**: Combined scroll and mouse tracking effects
  - **Responsive Design**: Mobile and desktop optimized layouts
- 📺 **YouTubeEmbed Component** - CSP-safe YouTube video embedding with pure ODS color integration and dependency cleanup ✅
- 📦 **PageContainer Component** - Standardized layout container ensuring consistent spacing and responsive design across all sections ✅
- 🎯 **FigmaPrototypeViewer** - ✅ FULLY COMPLETED (2025-08-17):
  - **RESOLVED**: Smooth navigation without iframe reloads using Figma Embed Kit 2.0 API
  - **RESOLVED**: Event-driven loading system with no timeouts (pure React patterns)
  - **RESOLVED**: Mobile touch interaction system solving cross-origin iframe conflicts
  - **RESOLVED**: Visual polish with transparent backgrounds and clean presentation
  - **REVOLUTIONARY**: Advanced touch gesture detection for mobile devices
  - **MODERN**: 2025 web development standards with unified state management
  - **NEW**: Enhanced Configuration System (2025-08-17):
    - **Split Mobile/Desktop**: Separate file keys and starting points for optimal device experience
    - **Environment Overrides**: Complete environment variable system for deployment flexibility
    - **Configurable Dimensions**: Content dimensions via props and environment variables
    - **Enhanced Debug Panel**: Active node ID display and resolved configuration monitoring
    - **Modern Architecture**: Pure split configuration - NO LEGACY SUPPORT

### Scope Clarification

UI-Kit provides **reusable, platform-agnostic components**. Platform-specific business components (like `openmsp-video-stats-section.tsx`) live in the main application and use UI-Kit components and design tokens.

### Recent Critical Bug Fixes (2025-08-28)

- **Profile Image & Upload System Fixes**:
  - **Google Profile Images**: Fixed net::ERR_BLOCKED_BY_CLIENT errors from ad blockers/privacy extensions
    - Implemented existing `getProxiedImageUrl` pattern from CommentCard for external images
    - Consistent profile picture handling across all user display components
  - **API Parameter Consistency**: Fixed admin users API returning 0 results when `isReal` parameter not provided
    - Root cause: `searchParams.get('isReal')` returns `null` (not `undefined`) for missing parameters
    - Fixed parameter parsing logic to handle URLSearchParams behavior correctly
  - **Profile Photo Upload Errors**: Resolved "Cannot read properties of undefined (reading 'from')" errors
    - Fixed Buffer type mismatch: changed `Buffer.from()` to `new Uint8Array()` for Supabase compatibility
    - Corrected client reference: `clients.serviceRoleClient` → `clients.publicClient`
    - Applied fixes across ALL image upload routes system-wide
  - **Next.js 15 Compatibility**: Updated dynamic route parameters for async handling
    - Changed `{ params: { id: string } }` to `{ params: Promise<{ id: string }> }`
    - Added proper `await` for parameter destructuring in 6+ route files
  - **SSO Profile Preservation**: Prevented OAuth logins from overriding manually uploaded profile photos
    - Only updates profile fields from SSO if they were previously empty/null
    - Preserves user customizations while importing missing data from OAuth providers
    - Comprehensive field-by-field empty checking with trim() validation

### Recent Updates (2025-08-17)

- **YouTube Embed Cleanup**: Complete dependency and color token migration
  - **Dependency Cleanup**: react-player removed from main package.json (kept only in UI-Kit)
  - **Color Token Migration**: All hardcoded colors (`#FF6B6B`, `#2A1F1F`, `#FFD951`) replaced with pure ODS tokens
  - **Component Consolidation**: Deleted obsolete `lib/utils/lite-youtube-embed.tsx` file
  - **Import Updates**: Updated `media-carousel.tsx` and `simple-markdown-renderer.tsx` to use UI Kit YouTubeEmbed

### Recent Updates (2025-08-14)

- **ODS Design System Compliance**: 
  - Replaced all hardcoded colors with ODS design tokens
  - Fixed hover states and accent colors throughout
  - Improved error displays with proper containment
- **Navigation Component Enhancements**:
  - Removed .md extensions from display names
  - Fixed README sorting in multi-level navigation
  - Added yellow accent ribbon for selected items
- **Jobs Dashboard Integration**:
  - Centralized job configuration with metadata
  - Dynamic job name display from metadata
  - OpenFrame Docs job properly named and positioned

### Recent Updates (2025-08-13)

- **Investors Management Feature**: Complete investor management system with admin interface
  - Modal-based admin following blog-posts pattern with InvestorFormModal component
  - File upload integration for logo management with Supabase storage
  - Funding rounds selector component with visual icons
  - Public display section with Figma-compliant design
- **Button Component Enhancement**: Fixed onClick prop support when href is provided
- **Header Dropdown Fix**: Dropdown menus now close properly on navigation
- **Component Cleanup**: Removed unified button components (TryOpenFrameButton, StartWithOpenFrameButton, GithubRepoButton)

## Installation

```bash
npm install @flamingo/ui-kit
```

## Usage

### Components

```tsx
import { Button, Card, Input, Modal, ModalHeader, ModalTitle, ModalFooter, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@flamingo/ui-kit/components/ui'
import { SSOModal, ErrorBoundary, YouTubeEmbed } from '@flamingo/ui-kit/components/features'
import { GitHubIcon, XLogo, OpenFrameLogo } from '@flamingo/ui-kit/components/icons'
import { FlamingoLogo, OpenMSPLogo } from '@flamingo/ui-kit/components' // Legacy individual imports
import { useToast } from '@flamingo/ui-kit/hooks'
// Access Code System
import { validateAccessCode, consumeAccessCode, validateAndConsumeAccessCode, useAccessCodeIntegration } from '@flamingo/ui-kit/utils/access-code-client'
import { AccessCodeValidation, AccessCodeValidationResponse, AccessCodeConsumptionResponse } from '@flamingo/ui-kit/types/access-code-cohorts'
import { Info } from 'lucide-react'

function MyComponent() {
  const { toast } = useToast()
  
  return (
    <TooltipProvider>
      <Card>
        <Button 
          variant="primary" 
          onClick={() => toast({ title: "Success!", description: "Action completed" })}
        >
          Click me
        </Button>
        <Input placeholder="Enter text..." />
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-4 w-4 text-ods-text-secondary" />
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-sm">Helpful information about this feature</p>
          </TooltipContent>
        </Tooltip>
        
        <Modal isOpen={showModal} onClose={() => setShowModal(false)}>
          <ModalHeader>
            <ModalTitle>Reliable Modal</ModalTitle>
          </ModalHeader>
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleAction}>Confirm</Button>
          </ModalFooter>
        </Modal>
        
        {/* YouTube embed with customizable controls */}
        <YouTubeEmbed 
          videoId="TqrBjLXMkgc"
          title="OpenMSP Community Overview"
          showTitle={false}
          showMeta={false}
          minimalControls={true}
          className="rounded-md"
        />
      </Card>
    </TooltipProvider>
  )
}
```

### Loading Skeletons

```tsx
import { 
  Skeleton, 
  SkeletonText, 
  SkeletonHeading,
  SkeletonCard,
  SkeletonGrid,
  SkeletonButton,
  SkeletonList,
  SkeletonNavigation
} from '@flamingo/ui-kit/components/ui'

function LoadingPage() {
  return (
    <div className="p-6">
      {/* Heading skeleton */}
      <SkeletonHeading level={1} className="mb-6" />
      
      {/* Text skeleton with 3 lines */}
      <SkeletonText lines={3} className="mb-8" />
      
      {/* Grid of 6 skeleton cards in 3 columns */}
      <SkeletonGrid columns={3} items={6} className="mb-8" />
      
      {/* Button skeleton */}
      <SkeletonButton size="lg" />
      
      {/* List with 5 items */}
      <SkeletonList items={5} />
    </div>
  )
}
```

### ParallaxImageShowcase

```tsx
import { ParallaxImageShowcase } from '@flamingo/ui-kit/components/features'

function HeroSection() {
  return (
    <section className="overflow-x-hidden">
      <ParallaxImageShowcase
        images={[
          {
            src: '/assets/dashboard-1.png',
            alt: 'Dashboard Screenshot 1',
            position: 'left'  // z-index 3 (on top)
          },
          {
            src: '/assets/dashboard-2.png', 
            alt: 'Dashboard Screenshot 2',
            position: 'center'  // z-index 2 (middle)
          },
          {
            src: '/assets/dashboard-3.png',
            alt: 'Dashboard Screenshot 3',
            position: 'right'  // z-index 1 (behind)
          }
        ]}
        className="lg:ml-10"
      />
    </section>
  )
}
```

**Features**:
- Global mouse tracking that works across entire page
- Scroll-based animations that work everywhere
- Responsive layout for mobile and desktop (lg: breakpoint)
- Configurable animation intensity via INTENSITY variable
- Framer Motion-powered smooth animations
- Three-layer depth perception with proper z-indexing

### YouTubeEmbed Component

```tsx
import { YouTubeEmbed } from '@flamingo/ui-kit/components/features'

function VideoSection() {
  return (
    <div className="space-y-8">
      {/* Minimal video for product showcases */}
      <YouTubeEmbed 
        videoId="TqrBjLXMkgc"
        title="OpenMSP: Transforming MSP Communities"
        showTitle={false}
        showMeta={false}
        minimalControls={true}
        className="rounded-md"
      />
      
      {/* Full video for blog posts */}
      <YouTubeEmbed 
        videoId="someVideoId"
        title="Tutorial: Getting Started"
        showTitle={true}
        showMeta={true}
        minimalControls={false}
      />
    </div>
  )
}
```

**Features**:
- CSP-safe iframe implementation (no script loading violations)
- Configurable UI controls: title, meta info, minimal controls
- Strips "more videos" suggestions when minimalControls=true
- Responsive design with pure ODS theming (no hardcoded colors)
- Cross-platform compatibility (OpenMSP, Flamingo, Admin-Hub, OpenFrame)
- Blog shortcode integration: `{{youtube:VIDEO_ID}}`
- Clean dependency management (react-player kept only in UI-Kit)

### Sticky Navigation

```tsx
import { StickySectionNav, useSectionNavigation } from '@flamingo/ui-kit/components/navigation'

function DocumentationPage() {
  const sections = [
    { id: 'introduction', title: 'Introduction', ref: useRef<HTMLElement>(null) },
    { id: 'installation', title: 'Installation', ref: useRef<HTMLElement>(null) },
    { id: 'configuration', title: 'Configuration', ref: useRef<HTMLElement>(null) }
  ]
  
  const { activeSection, handleSectionClick } = useSectionNavigation(sections, {
    offset: 100 // Offset from top when scrolling
  })
  
  return (
    <div className="flex">
      <main>
        {sections.map(section => (
          <section key={section.id} id={section.id} ref={section.ref}>
            {/* Section content */}
          </section>
        ))}
      </main>
      
      <StickySectionNav
        sections={sections}
        activeSection={activeSection}
        onSectionClick={handleSectionClick}
      />
    </div>
  )
}
```

**Features**:
- Native browser scroll API for smooth, reliable scrolling
- Flag-based system prevents scroll detection conflicts
- Customizable scroll offset for fixed headers
- Automatic active section highlighting
- Mobile-responsive with proper breakpoints

### Authentication Components

OpenFrame implements a modular, sections-based authentication architecture following the multi-platform-hub pattern:

```tsx
import { AuthProvidersList } from '@flamingo/ui-kit/components/features'

// Main orchestrator (like about-page.tsx pattern)  
export default function OpenFrameAuthPage() {
  const { navigateTo } = useNavigation()
  
  return (
    <div className="min-h-screen bg-ods-bg flex flex-col lg:flex-row">
      <AuthChoiceSection onAction={handleAction} />
      <AuthBenefitsSection /> {/* Shared across all auth screens */}
    </div>
  )
}

// Individual sections using UI-Kit components
export function AuthChoiceSection({ onAction }) {
  return (
    <div className="w-full lg:w-1/2 p-6 lg:p-20">
      <AuthProvidersList 
        enabledProviders={providers}
        onProviderClick={handleAuth}
        orientation="vertical"
      />
    </div>
  )
}
```

**Navigation Integration:**
```tsx
import { useNavigation, authRoutes } from '@/lib/navigation'

// Navigation utilities for proper URL routing with browser history
const { navigateTo, replace } = useNavigation()
navigateTo(authRoutes.signup) // Updates both state and URL
```

**URL Structure:**
- `/auth` → AuthChoiceSection (organization setup)
- `/auth/signup` → AuthSignupSection (user registration)  
- `/auth/login` → AuthLoginSection (SSO provider selection)

### Hooks

```tsx
import { useDebounce, useMediaQuery, usePlatformConfig } from '@flamingo/ui-kit/hooks'

function MyComponent() {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const platformConfig = usePlatformConfig()
  const debouncedValue = useDebounce(searchTerm, 300)
  
  // Your component logic
}
```

### Utilities

```tsx
import { cn, getPlatformAccentColor, formatDate } from '@flamingo/ui-kit/utils'
import {
  getPlatformIconComponent,
  getPlatformDisplayName,
  getPlatformColor,
  getPlatformDescription,
  isValidPlatform,
  getAllPlatformNames
} from '@flamingo/ui-kit/utils/platform-config'

function MyComponent({ className, platformName }) {
  return (
    <div className={cn('base-styles', className)}>
      <span style={{ color: getPlatformAccentColor() }}>
        {formatDate(new Date())}
      </span>

      {/* Platform-specific elements */}
      <div className="flex items-center gap-2">
        {getPlatformIconComponent(platformName, 'h-6 w-6')}
        <span className="font-medium">{getPlatformDisplayName(platformName)}</span>
        <span className="text-sm text-ods-text-secondary">
          {getPlatformDescription(platformName)}
        </span>
      </div>
    </div>
  )
}
```

### Styles

```tsx
// Import in your main layout or _app.tsx
import '@flamingo/ui-kit/styles'
```

## Platform Support

The UI kit automatically adapts to different platforms:

- **OpenMSP** (`openmsp`) - Yellow accent colors (#FFC008), MSP-focused components
- **Admin Hub** (`admin-hub`) - Pink accent colors (#F357BB), professional admin interface
- **OpenFrame** (`openframe`) - Cyan accent colors (#5EFAF0), framework-focused design
- **Flamingo** (`flamingo`) - Pink accent with light theme, brand-focused web presence
- **Flamingo Teaser** (`flamingo-teaser`) - Marketing/landing page styling

Platform detection is automatic based on the `NEXT_PUBLIC_APP_TYPE` environment variable. All components include hover, focus, active, and disabled states with proper accessibility support.

## Icons System

### Icon Organization
The UI Kit provides icons in two patterns:

**Centralized Icons** (recommended for new icons):
```tsx
import { GitHubIcon, XLogo, OpenFrameLogo, RedditIcon } from '@flamingo/ui-kit/components/icons'

// Usage with customizable props
<OpenFrameLogo className="h-8 w-8" />
<GitHubIcon size={24} />
<XLogo color="#1DA1F2" />
```

**Individual Icon Components** (legacy pattern):
```tsx
import { FlamingoLogo } from '@flamingo/ui-kit/components/flamingo-logo'
import { UserIcon } from '@flamingo/ui-kit/components/user-icon'
import { VendorIcon } from '@flamingo/ui-kit/components/vendor-icon'
```

### Available Icons
- **Social/Platform**: GitHubIcon, XLogo, RedditIcon, SlackIcon, HubspotIcon
- **Branding**: OpenFrameLogo, FlamingoLogo, OpenMSPLogo, ElestioLogo
- **UI Elements**: HamburgerIcon, MenuIcon, SendIcon, UserIcon, VendorIcon
- **Actions**: CheckCircleIcon, PlusCircleIcon, MinusCircleIcon, EditProfileIcon
- **Custom**: CustomStarIcon, CustomForkIcon, CustomLicenseIcon, CustomTimeIcon

### Migration Status
- ✅ **Centralized Export**: `/src/components/icons/index.ts` established
- 🔄 **Gradual Migration**: Individual icons being moved to centralized structure
- ✅ **TypeScript Support**: Full type safety with proper prop interfaces
- ✅ **Platform Theming**: Icons adapt to platform color schemes automatically

## Development

This is a source-only package, so no build step is required. Changes are reflected immediately in consuming projects.

```bash
# Type checking (zero errors achieved!)
npm run type-check

# Linting (when configured)
npm run lint
```

### Recent Major Improvements ✅

**TypeScript & Build Pipeline**:
- **Zero TypeScript Errors**: All compilation errors resolved across the entire UI kit
- **Import/Export Chain**: Fixed missing exports causing "Pagination is not exported" and "Slider is not exported" errors
- **Tailwind Integration**: Simplified fontSize configuration for TypeScript compatibility

**Core UI Components**:
- **Toast System**: Fixed positioning, z-index, stacking, and width issues for reliable notifications
- **Button Components**: Resolved text visibility issues, all variants working correctly with proper icon support
- **Modal System**: Reliable modal implementation with proper accessibility and theming
- **Comment Card**: Full MSP display functionality with avatar overlays and responsive layouts

**Authentication & Context**:
- **Auth Integration**: Real authentication context forwarding from main app to ui-kit components
- **Comment Deletion**: Working deletion logic in both profile and vendor contexts
- **User Summary**: Complete MSP badge overlay system with proper image processing

**Vendor & Media Processing**:
- **Vendor Icons**: Complete vendor logo processing with Supabase URL fixing and image proxy support
- **Vendor Tags**: Working vendor category display with proper media handling
- **Image Processing**: Enhanced image proxy utilities with OpenMSP domain detection

**Platform Integration**:
- **Join Waitlist Button**: OpenFrame icon integration across all platforms and footer components
- **OpenFrame Logo**: Full SVG component with customizable colors for branding consistency
- **Deployment Integration**: Smart URL detection for production vs staging environments
- **Form Integration**: Enhanced form modal components with proper API data binding

## Architecture

### Components
- `ui/` - Base components using Radix UI primitives (Button, Modal, Input, etc.)
- `features/` - Complex, platform-aware components (SSOModal, AnnouncementBar)
- `icons/` - Centralized icon components (GitHubIcon, XLogo, OpenFrameLogo, RedditIcon)
- Individual icon files - Legacy pattern being migrated to centralized structure

### Hooks
- `ui/` - UI utility hooks (useDebounce, useMediaQuery, useToast)
- `platform/` - Platform configuration and detection (usePlatformConfig)
- `api/` - Data fetching hooks (useAnnouncements)

### Working Components ✅
- **Button**: All variants with proper text visibility and icon support (leftIcon, rightIcon)
- **Modal**: Reliable modal system with accessibility and escape key handling
- **Toast**: Complete notification system with proper positioning, z-index, and stacking
- **Tooltip**: Radix-based tooltips with z-index 2147483647 for proper layering
- **Header**: Navigation header with configurable auto-hide behavior on scroll (z-[50])
- **Sliding Sidebar**: Mobile navigation with proper z-index management (z-[40]/z-[45])
- **Comment Card**: Full MSP display with avatar overlays and deletion functionality
- **User Summary**: Complete user display with MSP badges and responsive layouts
- **Join Waitlist Button**: OpenFrame icon integration with customizable colors
- **Vendor Display**: VendorIcon and VendorTag with full media processing
- **Input/Form Elements**: Full form component suite with API integration
- **Theme System**: Platform-aware ODS design tokens with full state variations
- **Skeleton Components**: Comprehensive loading skeletons (Text, Card, Grid, Button, Heading, List, Navigation)
- **ParallaxImageShowcase**: Interactive image showcase with parallax effects for hero sections

### Client-Side Only
This package contains **only client-side code**:
- ✅ React components and hooks
- ✅ Browser utilities and helpers
- ✅ CSS and styling
- ❌ No server-side code
- ❌ No API routes or server utilities
- ❌ No database connections

## Component Achievements

### FigmaPrototypeViewer ✅ FULLY FUNCTIONAL

The `FigmaPrototypeViewer` component (`src/components/features/figma-prototype-viewer.tsx`) is now a fully working, production-ready component:

**✅ What It Successfully Does:**
- Embeds and displays Figma prototypes with smooth navigation between sections
- Implements event-driven loading system using Figma's `NEW_STATE` event
- Provides responsive sizing with automatic device detection (desktop/mobile/touch)
- Handles complex mobile touch interactions solving cross-origin iframe limitations
- Offers unified state management with modern React patterns
- Supports multiple prototype configurations with platform-specific starting points

**🎯 Revolutionary Mobile Solution:**
- **Cross-Origin Challenge Solved**: Implemented intelligent touch overlay system
- **Gesture Detection**: Distinguishes between scroll intent and click intent
- **Natural UX**: Both page scrolling AND iframe interaction work seamlessly
- **Technical Innovation**: 500ms interaction window for natural human behavior

### Access Code System

Complete client-side utilities for cohort-based early access management:

```tsx
import {
  validateAccessCode,
  consumeAccessCode,
  validateAndConsumeAccessCode,
  useAccessCodeIntegration
} from '@flamingo/ui-kit/utils/access-code-client'

// Basic validation workflow
async function checkAccessCode(email: string, code: string) {
  const result = await validateAccessCode(email, code)

  if (result.valid) {
    console.log(`Welcome to ${result.cohort_name}!`)
    // Proceed with registration
  } else {
    console.error(result.message)
    // Show error to user
  }
}

// React Hook integration
function RegistrationForm() {
  const { validateAndConsume, isProcessing } = useAccessCodeIntegration()
  const [formData, setFormData] = useState({ email: '', code: '' })
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const result = await validateAndConsume(formData.email, formData.code)

    if (result.valid && result.consumed) {
      // Registration successful - access code validated and marked as used
      window.location.href = '/welcome'
    } else {
      setError(result.message || 'Invalid access code')
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>Email:</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          required
        />
      </div>

      <div>
        <label>Access Code:</label>
        <input
          type="text"
          value={formData.code}
          onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
          placeholder="Enter your access code"
          required
        />
      </div>

      {error && <div className="text-red-500 text-sm">{error}</div>}

      <button type="submit" disabled={isProcessing}>
        {isProcessing ? 'Processing...' : 'Register'}
      </button>
    </form>
  )
}

// Advanced workflow - separate validation and consumption
async function advancedRegistrationFlow(userData) {
  // Step 1: Validate access code before processing
  const validation = await validateAccessCode(userData.email, userData.accessCode)

  if (!validation.valid) {
    throw new Error(validation.message)
  }

  // Step 2: Process user registration
  try {
    const user = await registerUser(userData)

    // Step 3: Consume access code only after successful registration
    const consumption = await consumeAccessCode(userData.email, userData.accessCode)

    if (!consumption.consumed) {
      console.warn('Warning: Registration succeeded but access code could not be marked as used')
    }

    return user
  } catch (error) {
    // Registration failed - access code remains unused
    throw error
  }
}
```

**Features:**
- **Server-Side Validation**: All validation happens on the server to prevent race conditions
- **One-Time Use**: Codes are automatically marked as used after consumption
- **React Hook Integration**: `useAccessCodeIntegration()` hook with loading states
- **TypeScript Support**: Complete type definitions for all interfaces
- **Security Features**: Email validation, case-insensitive code handling, comprehensive error messages
- **Flexible Workflows**: Support for validate-only, consume-only, or combined operations
- **Production Ready**: Comprehensive error handling and user feedback systems

**API Endpoints Used:**
- `POST /api/validate-access-code` - Check code validity without consuming
- `POST /api/consume-access-code` - Mark code as used after successful registration

**Usage Workflow:**
1. **Validate First**: Always check if access code is valid before processing registration
2. **Register User**: Complete your application's user registration process
3. **Consume After Success**: Only mark code as used after successful registration
4. **Handle Errors**: Provide clear error messages for invalid, expired, or already-used codes

This system provides complete cohort-based early access management with unified client utilities, React hooks, and server-side validation for production-ready implementation across all platforms.

**🏗️ Technical Architecture (2025 Standards):**
- **Event-Driven**: No setTimeout usage, pure React event handling
- **Unified State**: Single state interface managing all component states  
- **PostMessage API**: Direct communication with Figma using `NAVIGATE_TO_FRAME_AND_CLOSE_OVERLAYS`
- **Performance**: Optimized with `useMemo`, `useCallback`, proper dependency arrays
- **Accessibility**: Proper ARIA labels, keyboard navigation, focus management

### FigmaPrototypeViewer Configuration System

The enhanced configuration system provides maximum flexibility for deployments and device optimization:

```tsx
import { FigmaPrototypeViewer, type FigmaPrototypeViewerConfig } from '@flamingo/ui-kit/components/features'

const config: FigmaPrototypeViewerConfig = {
  // SPLIT MOBILE/DESKTOP CONFIGURATION
  desktopFileKey: 'cUlttG0yUwiYlfIRfoqrX6',  // Desktop-specific Figma file
  mobileFileKey: 'erC12EwP5IxZU7vXrLv2eg',   // Mobile-specific Figma file
  
  // STARTING POINTS (can be overridden by env vars)
  desktopStartingPoint: '1:258',  // Default desktop starting node
  mobileStartingPoint: '1:261',   // Default mobile starting node
  
  // CONFIGURABLE CONTENT DIMENSIONS
  desktopContentDimensions: { width: 944, height: 600 },  // Desktop content size
  mobileContentDimensions: { width: 343, height: 440 },   // Mobile content size
  
  title: 'AI Co-Pilots Demo',
  sections: [
    {
      id: 'intake',
      number: '1.',
      title: 'Fae triages the request',
      startingNodeId: '1:258',        // Desktop node
      mobileStartingNodeId: '1:261'   // Mobile node  
    },
    // Additional sections...
  ]
}

<FigmaPrototypeViewer config={config} />
```

**Environment Variable Override System:**
```bash
# .env.local or deployment environment
# Override file keys
NEXT_PUBLIC_FIGMA_DESKTOP_FILE_KEY=newDesktopFileKey
NEXT_PUBLIC_FIGMA_MOBILE_FILE_KEY=newMobileFileKey

# Override starting points
NEXT_PUBLIC_FIGMA_DESKTOP_STARTING_POINT=1:123
NEXT_PUBLIC_FIGMA_MOBILE_STARTING_POINT=1:456

# Override content dimensions
NEXT_PUBLIC_FIGMA_DESKTOP_WIDTH=1200
NEXT_PUBLIC_FIGMA_DESKTOP_HEIGHT=800
NEXT_PUBLIC_FIGMA_MOBILE_WIDTH=375
NEXT_PUBLIC_FIGMA_MOBILE_HEIGHT=500

# Enable debug panel
NEXT_PUBLIC_FIGMA_DEBUG=true
```

**Configuration Hierarchy:**
1. **Environment Variables** (highest priority) - Override everything for deployment flexibility
2. **Component Config** (medium priority) - Per-component configuration via props
3. **Default Values** (lowest priority) - Fallback values for reliable operation

**Enhanced Debug Panel:**
When `NEXT_PUBLIC_FIGMA_DEBUG=true`, shows:
- Current view mode (DESKTOP/MOBILE/MOBILE_TOUCH)
- Iframe loading state and navigation status
- Resolved file key and starting point from configuration hierarchy
- Current content dimensions and scaling factors
- Active Figma node ID for navigation tracking
- Complete configuration resolution details

**🎨 Visual Polish:**
- Transparent iframe backgrounds for clean presentation
- Proper ODS theming throughout
- Loading skeletons with seamless transitions
- Mobile-first responsive design

**📱 Device Support:**
- **Desktop**: Full prototype experience with section navigation
- **Mobile**: Optimized layout with touch-friendly interactions  
- **Touch Devices**: Revolutionary touch handling for iframe interaction

## Platform Configuration Unification System (COMPLETED ✅)

### Overview
The UI-Kit provides a comprehensive platform configuration system that eliminates duplicate hardcoded mappings across all consuming applications. This system serves as the single source of truth for all platform-related data and operations.

### Key Features
- **Single Source of Truth**: All platform data centralized in `src/utils/platform-config.tsx`
- **Zero Code Duplication**: Eliminates duplicate platform mappings across components
- **Type Safety**: Full TypeScript interfaces for all platform operations
- **Future-Proofing**: New platforms automatically supported across all components
- **Admin-Hub Fixed**: Platform filters and badges display correctly for all platforms

### Usage

#### Platform Icons & Display Names
```tsx
import {
  getPlatformIconComponent,
  getSmallPlatformIcon,
  getPlatformDisplayName,
  getPlatformDescription,
  getPlatformColor,
  isValidPlatform
} from '@flamingo/ui-kit/utils/platform-config'

// Component rendering with dynamic platform support
function PlatformCard({ platformName }) {
  if (!isValidPlatform(platformName)) {
    return null
  }

  return (
    <div className="flex items-center gap-3 p-4 border rounded-lg">
      {/* Large platform icon */}
      {getPlatformIconComponent(platformName, 'h-8 w-8')}

      <div>
        <h3 className="font-medium">{getPlatformDisplayName(platformName)}</h3>
        <p className="text-sm text-ods-text-secondary">
          {getPlatformDescription(platformName)}
        </p>
      </div>

      {/* Small platform icon for badges */}
      <div className="ml-auto">
        {getSmallPlatformIcon(platformName)}
      </div>
    </div>
  )
}

// Filter components with platform awareness
function PlatformFilter({ selectedPlatforms, onPlatformChange }) {
  const allPlatforms = getAllPlatformNames()

  return (
    <div className="flex flex-wrap gap-2">
      {allPlatforms.map(platform => (
        <button
          key={platform}
          className="flex items-center gap-2 px-3 py-2 border rounded"
          style={{
            borderColor: selectedPlatforms.includes(platform)
              ? getPlatformColor(platform)
              : 'transparent'
          }}
          onClick={() => onPlatformChange(platform)}
        >
          {getPlatformIconComponent(platform, 'h-4 w-4')}
          {getPlatformDisplayName(platform)}
        </button>
      ))}
    </div>
  )
}
```

#### Available Utilities
```tsx
// Display and metadata functions
getPlatformDisplayName('admin-hub') // Returns: 'Admin Hub'
getPlatformDescription('openmsp') // Returns: 'MSP knowledge hub...'
getPlatformColor('flamingo') // Returns: '#FF6B6B'

// Validation and enumeration
isValidPlatform('admin-hub') // Returns: true
getAllPlatformNames() // Returns: ['openmsp', 'openframe', ...]
getPlatformCount() // Returns: 7

// Icon components (React elements)
getPlatformIconComponent('flamingo', 'h-6 w-6') // Returns: <FlamingoLogo />
getSmallPlatformIcon('tmcg') // Returns: <TMCGIcon className="h-6 w-6" />
```

#### Supported Platforms
- **OpenFrame** (`openframe`) - Open-source IT infrastructure platform
- **OpenMSP** (`openmsp`) - MSP knowledge hub and community
- **Flamingo** (`flamingo`) - AI-driven open-source OS for MSPs
- **Flamingo Teaser** (`flamingo-teaser`) - Coming soon landing page
- **Admin Hub** (`admin-hub`) - Unified admin interface
- **TMCG** (`tmcg`) - Miami cybersecurity community
- **Universal** (`universal`) - Cross-platform content

### Migration Benefits
Before the unified system, components had duplicate hardcoded mappings:

```tsx
// OLD WAY (eliminated) - duplicate across components
const platformIcons = {
  'admin-hub': <FlamingoLogo className="h-8 w-8" />,
  'openmsp': <OpenMSPLogo className="h-8 w-8" />
  // ...repeated in every component
}
```

```tsx
// NEW WAY (unified) - single source of truth
import { getPlatformIconComponent } from '@flamingo/ui-kit/utils/platform-config'

// Dynamic, consistent handling across all components
{getPlatformIconComponent(platform?.name || 'universal', 'h-8 w-8')}
```

### Integration Status
- **UI-Kit Location**: `src/utils/platform-config.tsx`
- **Component Adoption**: Successfully adopted by AnnouncementManagementDashboard, TrustOpensourceCard
- **Future-Ready**: Architecture prepared for database-driven platform management
- **Cross-Platform**: Works seamlessly across all platforms and consuming applications

## Contributing

When adding new components or utilities:

1. Keep everything client-side only
2. Follow the existing patterns and naming conventions
3. Add proper TypeScript types (zero errors policy)
4. Test across all supported platforms
5. Update exports in relevant `index.ts` files
6. Ensure components follow ODS design system
7. Include proper accessibility attributes
8. Test toast notifications and modal interactions
9. Verify button variants work across all themes
10. Test form integrations and API data binding
11. Validate component behavior in production and staging environments
12. **Use unified platform configuration system** - Never hardcode platform mappings in components

## License

Private package for Flamingo CX projects.

## Version History

### v1.5.0 (Latest)
- Added BenefitCard component with light/dark variants
- Improved loading skeleton standards
- Enhanced filter UI components
- Updated documentation with best practices

### v1.4.0 
- Configuration-driven Header and Footer components
- Fixed z-index hierarchy across all components
- Added tooltip system with Radix UI
- Improved button variants and accessibility

### v1.3.0
- Zero TypeScript errors achieved
- Complete toast system overhaul
- Modal system implementation
- Authentication component integration