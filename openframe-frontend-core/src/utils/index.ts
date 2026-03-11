// Utils exports - client-side only

export { getBaseUrl } from '../utils/cn';
export * from './access-code-client';
export { cn, formatBytes, formatDate, formatNumber, formatPrice, getAllPlatformBaseDomains } from './cn';
export { deepClone, delay, generateRandomString, getSlackCommunityJoinUrl, truncateString } from './common';
// Note: format and date-utils are imported via cn.ts to avoid duplicates
// AI confidence utilities
export * from './confidence-helpers';
// Release date formatting utilities
export * from './date-formatters';
// Dynamic icon registry
export * from './dynamic-icons';
export * from './format-relative-time';
export { type ColorCategory, getCurrentPlatform, getPlatformAccentColor } from './ods-color-utils';
export * from './os-platforms';
// OS type utilities
export * from './os-utils';
export * from './platform-config';
// Shell type utilities
export * from './shell-utils';
// Tool type utilities
export * from './tool-utils';
// Validation utilities
export * from './validation-utils';
