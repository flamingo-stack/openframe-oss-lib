// Profile system TypeScript interfaces for OpenMSP

export interface ProfileResponse {
  id: string;
  name: string;
  email: string;
  profilePicture: string | null;
  joinDate: string;
  authProvider: {
    type: 'google' | 'microsoft' | 'slack' | 'slack_oidc' | 'email';
    providers?: string[];
  };
  companyName: string | null;
  jobTitle: string | null;
  isCommunityMember: boolean;
  lastSignIn: string | null;
  department: string | null;
  employeeId: string | null;
}

export interface VendorInfo {
  id: number;
  title: string;
  slug: string;
  description: string;
  logo: string | null;
  isOpenSource: boolean;
  openMSPRating: number | null;
  avgRating: number | null;
  pricingModel: string | null;
  repository: string | null;
  githubStars: number | null;
  category: string | null;
  subcategory: string | null;
}

export interface FavoriteResponse {
  id: number;
  createdAt: string;
  vendor: VendorInfo;
}

export interface CommentResponse {
  id: string;
  content: string;
  title: string;
  type: 'pro' | 'con';
  importance: 'Critical' | 'Important' | 'Nice-to-have';
  createdAt: string;
  vendor: {
    id: number;
    title: string;
    slug: string;
    logo: string | null;
    category: string | null;
  };
  canDelete: boolean;
}

export interface ActivityResponse {
  id: number;
  type: string;
  description: string;
  createdAt: string;
  vendor: {
    id: number;
    title: string;
    slug: string;
    logo: string | null;
  } | null;
  metadata: Record<string, any> | null;
}

export interface ProfileData {
  profile: ProfileResponse;
  favorites: FavoriteResponse[];
  comments: CommentResponse[];
  activities: ActivityResponse[];
}

// API Response interfaces
export interface FavoritesApiResponse {
  favorites: FavoriteResponse[];
  total: number;
}

export interface CommentsApiResponse {
  comments: CommentResponse[];
  total: number;
  hasMore: boolean;
}

export interface ActivitiesApiResponse {
  activities: ActivityResponse[];
  total: number;
}

// Component Props interfaces
export interface ProfileHeaderProps {
  user: ProfileResponse;
  onEditProfile: () => void;
}

export interface FavoriteProductsGridProps {
  favorites: FavoriteResponse[];
  loading: boolean;
  onViewAll?: () => void;
}

export interface CommentCardProps {
  comment: CommentResponse;
  onViewProduct: (vendorSlug: string) => void;
  onDeleteComment: (commentId: string) => void;
}

export interface CommentsSectionProps {
  comments: CommentResponse[];
  loading: boolean;
  onLoadMore?: () => void;
}

export interface ActivityItemProps {
  activity: ActivityResponse;
}

export interface ProfileLoadingState {
  profile: boolean;
  favorites: boolean;
  comments: boolean;
  activities: boolean;
} 