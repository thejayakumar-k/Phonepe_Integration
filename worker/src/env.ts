export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  AI_MODEL?: string;
  ALLOWED_ORIGIN?: string;
  AI: unknown; // Workers AI binding
}