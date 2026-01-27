/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_WS_URL?: string;
  readonly VITE_AGENT_ID?: string;
  readonly VITE_AUTH_TOKEN?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_JINA_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
