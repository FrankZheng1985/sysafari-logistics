/// <reference types="vite/client" />

// 全局版本号常量（由 vite.config.ts 注入）
declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

