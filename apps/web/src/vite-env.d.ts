/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_APP_URL: string
  readonly VITE_DISCORD_ROLE_RESPONSABLE: string
  readonly VITE_DISCORD_ROLE_RESPONSABLE_BDM: string
  readonly VITE_DISCORD_ROLE_ANIMATEUR: string
  readonly VITE_DISCORD_ROLE_SENIOR: string
  readonly VITE_DISCORD_ROLE_MJ: string
  readonly VITE_DISCORD_ROLE_BDM: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
