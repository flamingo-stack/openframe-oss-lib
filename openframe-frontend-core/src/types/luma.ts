// Luma Events Types
// Used for Luma event management and display across admin interfaces

import { PlatformName } from './platform';

// Database Luma Event Model (from luma_events table)
export interface LumaEvent {
  id: string;
  luma_api_id: string;
  name: string;
  description: string;
  description_md?: string;
  cover_url?: string;
  event_url: string;
  start_at: string;
  end_at: string;
  duration_interval?: string;
  timezone: string;
  geo_address?: any;
  geo_latitude?: number;
  geo_longitude?: number;
  location_name?: string;
  location_full_address?: string;
  visibility: string;
  meeting_url?: string;
  registration_questions?: any[];
  tags: string[];
  platform: PlatformName;
  hosts?: any[];
  guest_count?: number;
  created_at: string;
  updated_at: string;
  last_synced_at: string;
}

// Event Status Types
export type EventStatus = 'upcoming' | 'past' | 'live' | 'cancelled' | 'all';

// Event Filter Types
export interface EventFilters {
  platform?: PlatformName | 'all';
  status?: EventStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}

// API Response Types
export interface EventsResponse {
  events: LumaEvent[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    pageSize: number;
  };
}

export interface EventStatsResponse {
  total_events: number;
  upcoming_events: number;
  past_events: number;
  total_attendees: number;
}

// Event Card Props
export interface EventCardProps {
  event: LumaEvent;
  onViewInLuma: (event: LumaEvent) => void;
  className?: string;
}

// Event Dashboard Props
export interface EventsDashboardProps {
  className?: string;
}

// Luma Event Host Type
export interface LumaEventHost {
  id: string;
  name: string;
  avatar_url?: string;
  email?: string;
}

// Luma Event Guest Type
export interface LumaEventGuest {
  id: string;
  name: string;
  avatar_url?: string;
  email?: string;
  registration_date: string;
  status: 'registered' | 'attended' | 'cancelled';
}

// Event Time Display Helpers
export interface EventTimeInfo {
  isUpcoming: boolean;
  isPast: boolean;
  isLive: boolean;
  timeUntilStart?: string;
  timeSinceEnd?: string;
  displayDate: string;
  displayTime: string;
}

// Event Location Info
export interface EventLocationInfo {
  isOnline: boolean;
  isInPerson: boolean;
  displayLocation: string;
  meetingUrl?: string;
  address?: string;
}

// Event Media Types
export interface EventMedia {
  id: string;
  event_id: string;
  media_type: 'image' | 'video';
  media_url: string;
  display_order: number;
  title?: string;
  description?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}