'use client';

import { Trash2, User, Globe, Youtube, Instagram, Facebook, MessageCircle, Send, Music, Mail } from 'lucide-react';
import { LinkedInIcon, GitHubIcon, XLogo, RedditIcon, SlackIcon, WhatsAppIcon } from '../icons';
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui';
import { SOCIAL_ICON_COMPONENTS } from '../social-icon-row';
import { normalizeSocialPlatform } from '../../utils/social-platforms';

export interface SocialLink {
  platform: string;
  url: string;
  username?: string;
  /** `internal` links render only on company-hub (server-enforced); default `external`. */
  visibility?: 'external' | 'internal';
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

export function SocialLinksManager({
  links,
  onChange,
  platforms = defaultPlatforms,
  className = '',
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
    const key = normalizeSocialPlatform(iconKey);
    if (!key) return null;
    const IconComponent = SOCIAL_ICON_COMPONENTS[key];
    return <IconComponent className="h-5 w-5 text-ods-text-secondary" />;
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {links.map((link, index) => {
        const platform = platforms.find(p => p.name === link.platform);
        const Icon = getIcon(link, platform);

        return (
          <div
            key={index}
            className="flex items-center gap-3 rounded-lg border border-ods-border bg-ods-bg-surface p-3"
          >
            <div className="flex h-8 w-8 items-center justify-center">{Icon}</div>

            <div className="grid flex-1 grid-cols-2 gap-3">
              <div>
                <Select value={link.platform} onValueChange={value => updateLink(index, 'platform', value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {platforms.map(p => (
                      <SelectItem key={p.name} value={p.name}>
                        {p.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Input
                placeholder={platform?.placeholder || 'Profile URL'}
                value={link.url}
                onChange={e => updateLink(index, 'url', e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
              />
            </div>

            <Select
              value={link.visibility ?? 'external'}
              onValueChange={value => updateLink(index, 'visibility', value)}
            >
              <SelectTrigger className="w-[120px] shrink-0" aria-label="Social link visibility">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="external">Public</SelectItem>
                <SelectItem value="internal">Internal</SelectItem>
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="transparent"
              size="icon"
              onClick={() => removeLink(index)}
              className="text-ods-error hover:bg-ods-error-secondary hover:text-ods-error-hover"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      })}

      {links.length === 0 && (
        <div className="py-8 text-center text-ods-text-secondary">
          <p className="text-h6">No social links added yet.</p>
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
