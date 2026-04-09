"use client";

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
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
      ? 'relative shrink-0 w-3 h-3'
      : 'relative shrink-0 w-4 h-4 md:w-5 md:h-5';
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

    // Schedule refresh every 5 minutes
    const interval = setInterval(fetchActiveAnnouncement, 300_000);
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
          className="relative shrink-0 w-4 h-4 md:w-5 md:h-5"
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
        <div
          className={`flex flex-row gap-2 items-center pl-3 md:pl-4 py-1 flex-1 min-w-0 ${
            announcement.cta_enabled && announcement.cta_url ? 'md:cursor-default cursor-pointer' : ''
          }`}
          onClick={(e) => {
            if (window.innerWidth < 768 && announcement.cta_enabled && announcement.cta_url) {
              e.preventDefault();
              handleCtaClick();
            }
          }}
        >
          {renderIcon()}

          <p className="font-body text-[12px] md:text-[13px] leading-snug mb-0 text-[#1A1A1A] min-w-0">
            <span className="font-bold">{announcement.title}</span>
            <span className="hidden md:inline font-normal"> — {announcement.description}</span>
          </p>
        </div>

        {/* CTA Button - Hidden on mobile, pushed to right on desktop */}
        {announcement.cta_enabled && announcement.cta_text && announcement.cta_url && (
          <div className="hidden md:flex flex-shrink-0">
            <button
              onClick={handleCtaClick}
              className="inline-flex items-center gap-1 rounded-[4px] px-2 py-0.5 text-[11px] font-semibold leading-tight whitespace-nowrap transition-opacity hover:opacity-90 border"
              style={{
                backgroundColor: announcement.cta_button_background_color || '#fff',
                color: announcement.cta_button_text_color || '#1A1A1A',
                borderColor: announcement.cta_button_background_color || '#1A1A1A',
              }}
            >
              {announcement.cta_show_icon && announcement.cta_icon &&
                getSvgIcon(announcement.cta_icon, 'cta', announcement.cta_icon_props ?? {})}
              {announcement.cta_text}
            </button>
          </div>
        )}

        {/* Dismiss button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDismiss();
          }}
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center hover:bg-[#1A1A1A]/10 rounded-sm mr-2 md:mr-3"
          aria-label="Dismiss announcement"
          type="button"
        >
          <X className="w-3 h-3 text-[#1A1A1A]" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
