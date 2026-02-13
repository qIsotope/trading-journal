import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseAdminClient: SupabaseClient | null = null;
let supabaseAuthClient: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient {
  if (supabaseAdminClient) {
    return supabaseAdminClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) are required'
    );
  }

  supabaseAdminClient = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabaseAdminClient;
}

export function getSupabaseAuthClient(): SupabaseClient {
  if (supabaseAuthClient) {
    return supabaseAuthClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabasePublishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (or legacy SUPABASE_ANON_KEY) are required'
    );
  }

  supabaseAuthClient = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabaseAuthClient;
}

export function isSupabaseConfigured() {
  return Boolean(
    process.env.SUPABASE_URL &&
    (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY) &&
    (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}
