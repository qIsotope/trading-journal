import {
  getSupabaseAdminClient,
  getSupabaseAuthClient,
  isSupabaseConfigured,
} from '../clients/supabaseClient';

export { getSupabaseAdminClient, getSupabaseAuthClient, isSupabaseConfigured };

export async function getUserByAccessToken(accessToken: string) {
  const supabaseAuth = getSupabaseAuthClient();
  const { data, error } = await supabaseAuth.auth.getUser(accessToken);

  if (error) {
    throw new Error(error.message);
  }

  return data.user;
}

export async function checkSupabaseHealth() {
  if (!isSupabaseConfigured()) {
    return { configured: false, healthy: false, error: 'Supabase env vars are missing' };
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });

    if (error) {
      return { configured: true, healthy: false, error: error.message };
    }

    return { configured: true, healthy: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Supabase error';
    return { configured: true, healthy: false, error: message };
  }
}
