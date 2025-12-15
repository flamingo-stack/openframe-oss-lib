/**
 * Slack Community TypeScript Interfaces
 * Based on Figma Frame 651 specifications
 */

export interface SlackUser {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  isOnline: boolean;
  title?: string;
  status?: 'online' | 'away' | 'busy' | 'offline';
}

export interface SlackChannel {
  id: string;
  databaseId?: string; // Database UUID for internal lookups
  name: string;
  isPrivate: boolean;
  memberCount: number;
  hasActivity: boolean;
  isJoined: boolean;
  lastActivity?: string;
  unreadCount?: number;
  isActive?: boolean; // Currently selected channel
}

export interface SlackMessage {
  id: string;
  user: SlackUser;
  message: string;
  timestamp: string;
  channel: string;
  type: 'message' | 'system' | 'join' | 'file';
  reactions?: Array<{
    emoji: string;
    count: number;
    users: string[];
  }>;
  isEdited?: boolean;
  thread?: {
    count: number;
    lastReply: string;
  };
}

export interface SlackCommunityStats {
  totalMembers: number;
  onlineMembers: number;
  activeToday: number;
  channelCount: number;
  messagesThisWeek: number;
}

export interface SlackCommunityData {
  stats: SlackCommunityStats;
  channels: SlackChannel[];
  recentMessages: SlackMessage[];
  onlineUsers: SlackUser[];
  currentUser?: SlackUser;
}

export interface SlackApiResponse {
  success: boolean;
  data: SlackCommunityData;
  timestamp: string;
  error?: string;
}

export interface UseSlackCommunityReturn {
  data: SlackCommunityData | null;
  isLoading: boolean;
  isLoadingMessages: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  sendMessage: (message: string, channelId?: string) => Promise<void>;
  switchChannel: (channelId: string) => void;
  activeChannelId: string;
}

export interface SlackTypingIndicator {
  userId: string;
  username: string;
  channelId: string;
}

export interface SlackReaction {
  emoji: string;
  count: number;
  users: string[];
  hasReacted?: boolean; // Current user has reacted
}

export interface SlackAttachment {
  id: string;
  type: 'image' | 'file' | 'link';
  name: string;
  url: string;
  size?: number;
  preview?: string;
}

export interface SlackMessageSendRequest {
  message: string;
  channelId: string;
  attachments?: SlackAttachment[];
  replyTo?: string; // For threading
} 