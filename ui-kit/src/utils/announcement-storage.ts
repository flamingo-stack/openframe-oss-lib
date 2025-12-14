// Stub for announcement storage
export interface AnnouncementStorageOptions {
  key: string;
  defaultValue?: any;
}

export function getStoredAnnouncement(key: string): any {
  if (typeof window !== 'undefined') {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null');
    } catch {
      return null;
    }
  }
  return null;
}

export function setStoredAnnouncement(key: string, value: any): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage errors
    }
  }
}

export function clearStoredAnnouncement(key: string = 'announcement'): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore storage errors
    }
  }
}