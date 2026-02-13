import { getSupabaseAdminClient, getSupabaseAuthClient } from '../clients/supabaseClient';

interface AuthSessionUserPair {
  session: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  };
  user: {
    id: string;
    email?: string;
  };
}

export async function createAuthUser(email: string, password: string) {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function signInWithEmailPassword(email: string, password: string) {
  const auth = getSupabaseAuthClient();
  const { data, error } = await auth.auth.signInWithPassword({ email, password });

  if (error || !data.session || !data.user) {
    throw new Error(error?.message || 'Invalid credentials');
  }

  return {
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      token_type: data.session.token_type,
    },
    user: {
      id: data.user.id,
      email: data.user.email,
    },
  } satisfies AuthSessionUserPair;
}

export async function refreshAuthSessionByToken(refreshToken: string) {
  const auth = getSupabaseAuthClient();
  const { data, error } = await auth.auth.refreshSession({ refresh_token: refreshToken });

  if (error || !data.session || !data.user) {
    throw new Error(error?.message || 'Invalid refresh token');
  }

  return {
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      token_type: data.session.token_type,
    },
    user: {
      id: data.user.id,
      email: data.user.email,
    },
  } satisfies AuthSessionUserPair;
}

export async function setAuthSession(accessToken: string, refreshToken: string) {
  const auth = getSupabaseAuthClient();
  const { error } = await auth.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function signOutGlobal() {
  const auth = getSupabaseAuthClient();
  const { error } = await auth.auth.signOut({ scope: 'global' });

  if (error) {
    throw new Error(error.message);
  }
}

export async function getAuthUserByAccessToken(accessToken: string) {
  const auth = getSupabaseAuthClient();
  const { data, error } = await auth.auth.getUser(accessToken);

  if (error) {
    throw new Error(error.message);
  }

  return data.user;
}
