import {
  createAuthUser,
  getAuthUserByAccessToken,
  refreshAuthSessionByToken,
  setAuthSession,
  signInWithEmailPassword,
  signOutGlobal,
} from '../repositories/authRepository';

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: {
    id: string;
    email: string | null;
  };
}

function formatAuthResponse(session: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: { id: string; email?: string | null };
}): AuthResponse {
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: {
      id: session.user.id,
      email: session.user.email ?? null,
    },
  };
}

export async function registerByEmailPassword(email: string, password: string): Promise<AuthResponse> {
  await createAuthUser(email, password);
  const loginData = await signInWithEmailPassword(email, password);

  return formatAuthResponse({
    ...loginData.session,
    user: {
      id: loginData.user.id,
      email: loginData.user.email,
    },
  });
}

export async function loginByEmailPassword(email: string, password: string): Promise<AuthResponse> {
  const data = await signInWithEmailPassword(email, password);

  return formatAuthResponse({
    ...data.session,
    user: {
      id: data.user.id,
      email: data.user.email,
    },
  });
}

export async function refreshAuthSession(refreshToken: string): Promise<AuthResponse> {
  const data = await refreshAuthSessionByToken(refreshToken);

  return formatAuthResponse({
    ...data.session,
    user: {
      id: data.user.id,
      email: data.user.email,
    },
  });
}

export async function logoutAuthSession(accessToken: string, refreshToken?: string) {
  if (refreshToken) {
    await setAuthSession(accessToken, refreshToken);
  }

  await signOutGlobal();
}

export async function getCurrentUser(accessToken: string) {
  const user = await getAuthUserByAccessToken(accessToken);
  if (!user) {
    throw new Error('Invalid token');
  }

  return {
    id: user.id,
    email: user.email ?? null,
  };
}
