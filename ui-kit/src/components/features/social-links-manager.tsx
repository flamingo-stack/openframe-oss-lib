"use client";

import { useState } from 'react';
import {
  LinkedInIcon,
  GitHubIcon,
  XLogo,
  RedditIcon,
  SlackIcon,
  WhatsAppIcon
} from '../icons';
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Label
} from '../ui';
import { Trash2, User, Globe, Youtube, Instagram, Facebook, MessageCircle, Send, Music } from 'lucide-react';

export interface SocialLink {
  platform: string;
  url: string;
  username?: string;
}

export interface SocialPlatform {
  id: string;
  name: string;
  display_name: string;
  icon_name: string;
  url_pattern?: string;
  placeholder?: string;
  enabled: boolean;
}

interface SocialLinksManagerProps {
  links: SocialLink[];
  onChange: (links: SocialLink[]) => void;
  platforms?: SocialPlatform[];
  className?: string;
}

// Default platforms if none provided (empty array to encourage using dynamic data)
const defaultPlatforms: SocialPlatform[] = [];

// Icon mapping - dynamically loaded based on database icon_name
const iconMap = {
  linkedin: LinkedInIcon,
  github: GitHubIcon,
  twitter: XLogo,
  reddit: RedditIcon,
  slack: SlackIcon,
  whatsapp: WhatsAppIcon,
  website: Globe,
  youtube: Youtube,
  instagram: Instagram,
  facebook: Facebook,
  discord: MessageCircle,
  telegram: Send,
  tiktok: Music,
};

export function SocialLinksManager({
  links,
  onChange,
  platforms = defaultPlatforms,
  className = ''
}: SocialLinksManagerProps) {
  const addLink = () => {
    const firstPlatform = platforms[0]?.name || 'website';
    onChange([...links, { platform: firstPlatform, url: '' }]);
  };

  const removeLink = (index: number) => {
    onChange(links.filter((_, i) => i !== index));
  };

  const updateLink = (index: number, field: keyof SocialLink, value: string) => {
    const updated = [...links];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const getIcon = (link: SocialLink, platform?: SocialPlatform) => {
    // Use database icon_name if available, fallback to platform name
    const iconKey = platform?.icon_name || link.platform;
    const IconComponent = iconMap[iconKey as keyof typeof iconMap];
    return IconComponent ? <IconComponent className="w-5 h-5 text-ods-text-secondary" /> : null;
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {links.map((link, index) => {
        const platform = platforms.find(p => p.name === link.platform);
        const Icon = getIcon(link, platform);

        return (
          <div key={index} className="flex items-center gap-3 p-3 bg-ods-bg-secondary rounded-lg border border-ods-border">
            <div className="w-8 h-8 flex items-center justify-center">
              {Icon}
            </div>

            <div className="flex-1 grid grid-cols-2 gap-3">
              <div>
                <Select
                  value={link.platform}
                  onValueChange={(value) => updateLink(index, 'platform', value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {platforms.map(p => (
                      <SelectItem key={p.name} value={p.name}>{p.display_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Input
                placeholder={platform?.placeholder || "Profile URL"}
                value={link.url}
                onChange={(e) => updateLink(index, 'url', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    e.stopPropagation()
                  }
                }}
              />
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeLink(index)}
              className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      })}

      {links.length === 0 && (
        <div className="text-center py-8 text-ods-text-secondary">
          <p className="text-sm">No social links added yet.</p>
        </div>
      )}

      <Button
        variant="outline"
        onClick={addLink}
        className="w-full"
        type="button"
        leftIcon={<User className="h-4 w-4" />}
      >
        Add Social Link
      </Button>
    </div>
  );
}