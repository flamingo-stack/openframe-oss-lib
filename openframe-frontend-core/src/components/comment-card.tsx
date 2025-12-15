import { Button } from "./ui/button"
import { VendorDisplayButton } from "./vendor-display-button"
import { useAuth } from "./auth-stub"
import Image from "next/image"
import { getProxiedImageUrl } from "../utils/image-proxy-stub"
import { formatRelativeTime } from "../utils/date-utils"
import { UserSummary } from "./user-summary-stub"

interface CommentCardProps {
  comment: {
    id: string
    content: string
    title?: string
    type?: 'pro' | 'con'
    importance?: 'Critical' | 'Important' | 'Nice-to-have'
    createdAt: string
    vendor?: {
      id: number
      title: string
      slug: string
      logo: string | null
      category?: string | null
    }
    user?: {
      id: string
      name: string
      profilePicture: string | null
      msp?: {
        id: string | number
        name?: string | null
        icon_url?: string | null
      }
    }
    canDelete?: boolean
  }
  onViewProduct?: (vendorSlug: string) => void
  onDeleteComment?: (commentId: string) => void
  showVendorInfo?: boolean
  compact?: boolean
  context: 'profile' | 'vendor'
}

export function CommentCard({ 
  comment, 
  onViewProduct, 
  onDeleteComment, 
  showVendorInfo = true,
  compact = false,
  context = 'profile'
}: CommentCardProps) {
  const { user: currentUser } = useAuth()
  
  // Use unified date formatting function
  const formatActivityTime = (timestamp: string) => {
    return formatRelativeTime(timestamp);
  }

  // Check if current user can delete this comment
  const canUserDeleteComment = () => {
    // If not authenticated, can't delete
    if (!currentUser) return false
    
    // For profile context, use the existing canDelete prop (since it's the user's own comments)
    if (context === 'profile') {
      return comment.canDelete !== false
    }
    
    // For vendor context, check if current user is the comment creator
    if (context === 'vendor' && comment.user) {
      return currentUser.id === comment.user.id
    }
    
    return false
  }

  const showDeleteButton = canUserDeleteComment()

  return (
    <div className="bg-ods-card border border-ods-border rounded-lg p-4 hover:border-[#FFC008] transition-all group overflow-hidden w-full max-w-full box-border" style={{ maxWidth: '100%', wordBreak: 'break-word' }}>
      {/* Comment Header */}
      <div className="flex flex-col gap-3 mb-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between min-[420px]:gap-2 w-full">
        {/* Row 1: Info + Timestamp */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {context === 'profile' && comment.vendor ? (
            <>
              {/* Vendor Button - Icon + Name */}
              <VendorDisplayButton
                vendor={comment.vendor}
                onClick={onViewProduct || (() => {})}
              />
              
              {/* Timestamp */}
              <span className="font-['DM_Sans'] font-medium text-[14px] leading-[1.43] text-ods-text-secondary whitespace-nowrap flex-shrink-0">
                {formatActivityTime(comment.createdAt)}
              </span>
            </>
          ) : context === 'vendor' && comment.user ? (
            <UserSummary
              name={comment.user.name}
              email=""
              compact
              avatarSize={48}
              subtitle={formatActivityTime(comment.createdAt)}
              avatarUrl={comment.user.profilePicture ?? null}
              mspPreview={comment.user.msp ? {
                name: comment.user.msp.name ?? null,
                logoUrl: comment.user.msp.icon_url ?? null,
                seatCount: null,
                technicianCount: null,
                annualRevenue: null,
              } : null}
              showEditButton={false}
              authProviders={[]}
            />
          ) : null}
        </div>
        
        {/* Row 2: Action Buttons */}
        <div className="flex gap-2 justify-start min-[420px]:justify-end">
          {/* Delete Button - shown when user can delete the comment */}
          {showDeleteButton && onDeleteComment && (
            <Button
              onClick={() => onDeleteComment(comment.id)}
              variant="outline"
              size="icon"
              className="text-ods-text-primary"
            >
              <svg width="22" height="24" viewBox="0 0 22 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-ods-text-primary">
                <path d="M18.6025 4.37939C19.221 4.43597 19.6768 4.98399 19.6206 5.60254L18.5176 17.7358C18.4492 18.4886 18.3924 19.1183 18.3052 19.6299C18.2155 20.1552 18.0809 20.6447 17.8101 21.1021C17.4444 21.7195 16.9245 22.2292 16.3042 22.583L16.0317 22.7251C15.5519 22.9533 15.0526 23.0438 14.5215 23.0854C14.0042 23.126 13.3727 23.125 12.6172 23.125H9.38281C8.62726 23.125 7.9958 23.126 7.47852 23.0854C7.01357 23.049 6.57289 22.975 6.14844 22.8042L5.96826 22.7251C5.32037 22.4169 4.76543 21.9454 4.35693 21.3599L4.18994 21.1021C3.91912 20.6447 3.78445 20.1552 3.69482 19.6299C3.65123 19.3743 3.61556 19.0894 3.58203 18.7744L3.48242 17.7358L2.37939 5.60254L2.375 5.48682C2.38099 4.91684 2.81768 4.43244 3.39746 4.37939C3.97776 4.32664 4.496 4.72462 4.60449 5.28467L4.62061 5.39746L5.72363 17.5322C5.79528 18.3203 5.84358 18.8475 5.9126 19.252C5.97923 19.6424 6.05232 19.8298 6.12646 19.9551L6.28467 20.1836C6.45963 20.3987 6.68118 20.5732 6.93359 20.6934L7.04639 20.7388C7.17478 20.7822 7.35781 20.8195 7.6543 20.8428C8.06325 20.8749 8.59186 20.875 9.38281 20.875H12.6172C13.4081 20.875 13.9367 20.8749 14.3457 20.8428C14.7409 20.8117 14.9349 20.7559 15.0664 20.6934L15.3066 20.5557C15.5369 20.4008 15.7309 20.1958 15.8735 19.9551C15.9477 19.8298 16.0208 19.6424 16.0874 19.252C16.1564 18.8475 16.2047 18.3203 16.2764 17.5322L17.3794 5.39746C17.436 4.77903 17.984 4.32316 18.6025 4.37939Z" fill="currentColor"/>
                <path d="M7.37451 15.9995V11C7.37451 10.3788 7.87842 9.87526 8.49951 9.875C9.12083 9.875 9.62451 10.3787 9.62451 11V15.9995C9.62451 16.6208 9.12083 17.1245 8.49951 17.1245C7.87842 17.1242 7.37451 16.6207 7.37451 15.9995ZM12.3755 15.9995V11C12.3755 10.3787 12.8792 9.875 13.5005 9.875C14.1216 9.87526 14.6255 10.3788 14.6255 11V15.9995C14.6255 16.6207 14.1216 17.1242 13.5005 17.1245C12.8792 17.1245 12.3755 16.6208 12.3755 15.9995ZM12.585 0.875C13.0174 0.879157 13.425 0.903301 13.8096 1.02881L14.1157 1.14746C14.4155 1.28159 14.6931 1.46221 14.9375 1.68359L15.0811 1.82568C15.4034 2.16872 15.6379 2.59872 15.8984 3.05469L16.6528 4.37451H20L20.1157 4.38037C20.6825 4.43826 21.1248 4.91747 21.125 5.49951C21.125 6.08174 20.6827 6.5607 20.1157 6.61865L20 6.62451H2C1.37868 6.62451 0.875 6.12083 0.875 5.49951C0.875264 4.87842 1.37884 4.37451 2 4.37451H5.34717L6.32129 2.6709C6.53952 2.29735 6.76267 1.95525 7.0625 1.68359L7.31738 1.47705C7.58262 1.28327 7.87687 1.1312 8.19043 1.02881L8.38525 0.974609C8.71199 0.896341 9.05467 0.878464 9.41504 0.875H12.585ZM9.85742 3.125C9.29191 3.125 9.08123 3.13201 8.97266 3.14844L8.88916 3.16748C8.83075 3.18655 8.77503 3.21301 8.72217 3.24365L8.57275 3.35205C8.53704 3.38448 8.50137 3.42629 8.42773 3.54102L8.05566 4.1709L7.93848 4.37451H14.0615L13.9443 4.1709C13.6645 3.68114 13.554 3.50141 13.4858 3.41504L13.4272 3.35205C13.3815 3.31062 13.3309 3.27443 13.2778 3.24365L13.1108 3.16748C13.019 3.13753 12.8946 3.125 12.1426 3.125H9.85742Z" fill="currentColor"/>
              </svg>
            </Button>
          )}
        </div>
      </div>
      
      {/* Comment Content */}
      <div className="space-y-2 w-full max-w-full overflow-hidden" style={{ maxWidth: '100%', wordBreak: 'break-word' }}>
        {comment.title && (
          <div className={compact ? "h-[20px] flex items-center" : "h-[24px] flex items-center"}>
            <h4 className="font-['DM_Sans'] font-bold text-lg leading-[1.33] tracking-[-0.02em] text-ods-text-primary group-hover:text-ods-accent transition-colors line-clamp-1" style={{ 
              wordBreak: 'break-word', 
              overflowWrap: 'break-word', 
              maxWidth: '100%',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 1
            }}>
              {comment.title}
            </h4>
          </div>
        )}
        <div className={compact ? "h-[60px] flex items-center" : "h-[72px] flex items-center"}>
          <p className="font-['DM_Sans'] font-medium text-lg leading-[1.33] text-ods-text-primary line-clamp-3" style={{ 
            wordBreak: 'break-word', 
            overflowWrap: 'break-word', 
            maxWidth: '100%',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 3
          }}>
            {comment.content}
          </p>
        </div>
      </div>
    </div>
  )
}