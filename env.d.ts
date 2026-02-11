/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLOUDBASE_ENV_ID: string
  readonly VITE_PUBLIC_BASE?: string
  readonly VITE_PRIVATE_WALL_PASSWORD?: string
  readonly VITE_MAX_CHAT_FILE_MB?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
