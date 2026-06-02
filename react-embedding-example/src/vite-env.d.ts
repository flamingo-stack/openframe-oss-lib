/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public hub origin for new-tab content links (embed mode). */
  readonly VITE_HUB_ORIGIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
