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
  return process.env.NEXT_PUBLIC_APP_TYPE || 'openmsp';
}