/**
 * The notification vocabulary and each category's icon: what an announcement
 * may state, and that a tile shows the icon of the section it belongs to (none
 * for GENERIC, INTEGRATIONS or a category the lib does not know).
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NOTIFICATION_CATEGORY,
  DEFAULT_NOTIFICATION_SEVERITY,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_LABELS,
  NOTIFICATION_SEVERITIES,
  NOTIFICATION_SEVERITY_LABELS,
  isNotificationCategory,
  isNotificationSeverity,
} from '../../../../utils/notifications';
import { notificationCategoryIcon } from '../notification-category-icon';

describe('notification vocabulary', () => {
  it('labels every severity and category', () => {
    for (const severity of NOTIFICATION_SEVERITIES) expect(NOTIFICATION_SEVERITY_LABELS[severity]).toBeTruthy();
    for (const category of NOTIFICATION_CATEGORIES) expect(NOTIFICATION_CATEGORY_LABELS[category]).toBeTruthy();
  });

  it('defaults to what the backend assumes when a field is left out', () => {
    expect(DEFAULT_NOTIFICATION_SEVERITY).toBe('INFO');
    expect(DEFAULT_NOTIFICATION_CATEGORY).toBe('GENERIC');
  });

  it('accepts only the backend enum values', () => {
    expect(isNotificationSeverity('DANGER')).toBe(true);
    expect(isNotificationSeverity('danger')).toBe(false);
    expect(isNotificationCategory('TICKETS')).toBe(true);
    expect(isNotificationCategory('constructor')).toBe(false);
    expect(isNotificationCategory(undefined)).toBe(false);
  });
});

describe('notificationCategoryIcon', () => {
  it('draws an icon for a dashboard section, the assistant mark for MINGO, any case', () => {
    for (const category of ['DEVICES', 'monitoring', 'TICKETS', 'MINGO']) {
      expect(notificationCategoryIcon(category)).toBeTruthy();
    }
  });

  it('has no icon for GENERIC, INTEGRATIONS, an unknown or a prototype name', () => {
    for (const category of ['GENERIC', 'INTEGRATIONS', 'NOPE', 'constructor', '', null, undefined]) {
      expect(notificationCategoryIcon(category)).toBeUndefined();
    }
  });
});
