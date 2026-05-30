/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public hub origin for new-tab content links (embed mode). */
  readonly VITE_HUB_ORIGIN?: string
  /** Chat source — must match the target hub's currentPlatform(). */
  readonly VITE_CHAT_SOURCE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
