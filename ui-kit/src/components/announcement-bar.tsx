"use client";

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { renderSvgIcon } from './icon-utils';
import {
  setStoredAnnouncement,
  getStoredAnnouncement,
  clearStoredAnnouncement,
} from '../utils/announcement-storage';
import { Announcement } from '../types/announcement';
import { getAppType } from '../utils/app-config';

// Helper that defers to renderSvgIcon so we don't need local icon imports
const getSvgIcon = (
  name: string,
  size: 'main' | 'cta' = 'main',
  extra: Record<string, any> = {}
) => {
  const cls =
    size === 'cta'
      ? 'relative shrink-0 w-3 h-3 md:w-4 md:h-4'
      : 'relative shrink-0 w-6 h-6 md:w-8 md:h-8';
  return renderSvgIcon(name, { className: cls, ...extra });
};

export function AnnouncementBar() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [isVisible, setIsVisible] = useState<boolean>(false);

  // Get the platform type for platform-specific localStorage keys
  const platform = getAppType();

  // Helper to determine dismissal key for localStorage
  const getDismissKey = (id: string) => `${platform}-announcement-${id}-dismissed`;
  
  // Helper to get platform-specific cache key
  const getCacheKey = () => `${platform}-announcement-cache`;

  // Fetch active announcement from API and update state + LS
  const fetchActiveAnnouncement = async () => {
    try {
      console.log(`📋 [${platform.toUpperCase()}] Fetching active announcement for current app`);

      // Server-side platform injection - no URL parameter needed
      const response = await fetch(`/api/announcements/active`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.announcement) {
          setAnnouncement(data.announcement);

          // persist latest announcement for quick future loads with platform-specific key
          setStoredAnnouncement(getCacheKey(), data.announcement);

          // Check if this specific announcement was dismissed
          const isDismissed = localStorage.getItem(getDismissKey(data.announcement.id));
          setIsVisible(!isDismissed);
        } else {
          // No announcement available - clean up localStorage and hide bar
          console.log(`📭 [${platform.toUpperCase()}] No active announcement available, cleaning up localStorage`);
          setAnnouncement(null);
          setIsVisible(false);
          
          // Use utility function to properly clear platform-specific announcement data
          clearStoredAnnouncement(getCacheKey());
        }
      } else {
        // Network or other error - hide announcement and clean up
        console.error(`❌ [${platform.toUpperCase()}] Error fetching announcement: ${response.status}`);
        setAnnouncement(null);
        setIsVisible(false);
        
        // Clear stale data on network errors too
        clearStoredAnnouncement(getCacheKey());
      }
    } catch (error) {
      console.error('Error fetching active announcement:', error);
      setAnnouncement(null);
      setIsVisible(false);
      
      // Clear stale data on exceptions too
      clearStoredAnnouncement(getCacheKey());
    }
  };

  // Initial load: use cached announcement synchronously for instant paint
  useEffect(() => {
    const cached = getStoredAnnouncement(getCacheKey());
    if (cached) {
      const isDismissed = localStorage.getItem(getDismissKey(cached.id));
      setAnnouncement(cached);
      setIsVisible(!isDismissed);
    }

    // Always fetch latest on mount
    fetchActiveAnnouncement();

    // Schedule refresh every 60 seconds
    const interval = setInterval(fetchActiveAnnouncement, 60_000);
    return () => clearInterval(interval);
  }, []);

  // helpers
  const handleDismiss = () => {
    if (!announcement) return;
    localStorage.setItem(getDismissKey(announcement.id), 'true');
    setIsVisible(false);
  };

  const handleCtaClick = () => {
    if (!announcement?.cta_url) return;
    announcement.cta_target === '_blank'
      ? window.open(announcement.cta_url, '_blank', 'noopener,noreferrer')
      : (window.location.href = announcement.cta_url);
  };

  const renderIcon = () => {
    if (!announcement) return null;

    if (announcement.icon_type === 'png' && announcement.icon_png_url) {
      return (
        <img
          src={announcement.icon_png_url}
          alt="Announcement icon"
          className="relative shrink-0 w-6 h-6 md:w-8 md:h-8"
          aria-hidden
        />
      );
    }

    return getSvgIcon(
      announcement.icon_svg_name || 'openframe-logo',
      'main',
      announcement.icon_svg_props ?? {}
    );
  };

  // If no announcement or dismissed => render nothing
  if (!announcement || !isVisible) return null;

  return (
    <div
      className="relative w-full z-50"
      style={{ backgroundColor: announcement.background_color }}
      data-announcement-bar
    >
      <div className="flex items-center w-full max-w-full">
        {/* Mobile: Clickable content area, Desktop: Regular content */}
        <div 
          className={`flex flex-row gap-2 md:gap-4 items-center pl-4 md:pl-6 py-1.5 md:py-2 flex-1 min-w-0 ${
            announcement.cta_enabled && announcement.cta_url ? 'md:cursor-default cursor-pointer' : ''
          }`}
          onClick={(e) => {
            // Only handle click on mobile (< 768px) and if CTA is enabled
            if (window.innerWidth < 768 && announcement.cta_enabled && announcement.cta_url) {
              e.preventDefault();
              handleCtaClick();
            }
          }}
        >
          {renderIcon()}

          <div className="flex-1 min-w-0 max-w-full">
            <p className="font-body font-bold text-[14px] md:text-[18px] leading-tight tracking-tight mb-0 text-[#1A1A1A] truncate">
              {announcement.title}
            </p>
            <p className="font-body text-[12px] md:text-[18px] leading-tight hidden sm:block text-[#1A1A1A] truncate">
              {announcement.description}
            </p>
          </div>

          {/* CTA Button - Hidden on mobile, shown on desktop */}
          {announcement.cta_enabled && announcement.cta_text && announcement.cta_url && (
            <div className="hidden md:flex flex-shrink-0 ml-1 md:ml-2">
              <Button
                onClick={handleCtaClick}
                variant="outline"
                size="sm"
                leftIcon={
                  announcement.cta_show_icon && announcement.cta_icon
                    ? getSvgIcon(
                        announcement.cta_icon,
                        'cta',
                        announcement.cta_icon_props ?? {}
                      )
                    : undefined
                }
                className="transition-opacity hover:opacity-90 text-xs md:text-sm whitespace-nowrap"
                style={{
                  backgroundColor: announcement.cta_button_background_color || undefined,
                  color: announcement.cta_button_text_color || undefined,
                  borderColor: announcement.cta_button_background_color || undefined,
                }}
              >
                {announcement.cta_text}
              </Button>
            </div>
          )}
        </div>

        {/* Dismiss button - always visible */}
        <button
          onClick={(e) => {
            e.stopPropagation(); // Prevent triggering the mobile CTA click
            handleDismiss();
          }}
          className="flex-shrink-0 w-8 h-8 md:w-10 md:h-10 flex items-center justify-center hover:bg-[#1A1A1A]/10 focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] mr-2 md:mr-4"
          aria-label="Dismiss announcement"
          type="button"
        >
          <X className="w-4 h-4 text-[#1A1A1A]" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
