// Stub app config
export const APP_CONFIG = {
  app: {
    type: 'openmsp',
    name: 'OpenMSP',
    domain: 'openmsp.ai'
  },
  features: {
    announcements: true,
    notifications: true
  }
} as const;

export function getAppConfig() {
  return APP_CONFIG;
}

export function getAppType() {
  // The exact `process.env.NEXT_PUBLIC_APP_TYPE` member expression is kept so
  // Next/webpack can statically inline it. The try/catch makes the call safe
  // in non-Next React hosts (Vite/CRA embeds) where `process` does not exist
  // at runtime — those hosts fall back to 'openmsp' or pass an explicit
  // platform where it matters (e.g. AnnouncementBar's `platform` prop).
  try {
    return process.env.NEXT_PUBLIC_APP_TYPE || 'openmsp';
  } catch {
    return 'openmsp';
  }
}