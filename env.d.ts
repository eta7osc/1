/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLOUDBASE_ENV_ID: string
  readonly VITE_PUBLIC_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
