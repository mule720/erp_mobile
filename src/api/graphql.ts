import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://api.netonerppro.com/graphql/';

const REFRESH_MUTATION = `
  mutation RefreshToken($refreshToken: String!) {
    refreshToken(refreshToken: $refreshToken) {
      token
      refreshToken
    }
  }
`;

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // Treat as expired 30s before actual expiry to avoid edge cases
    return payload.exp < Math.floor(Date.now() / 1000) + 30;
  } catch {
    return true;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await AsyncStorage.getItem('erp_refresh_token');
  if (!refreshToken) return null;
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: REFRESH_MUTATION, variables: { refreshToken } }),
    });
    const json = await res.json();
    const data = json?.data?.refreshToken;
    if (data?.token) {
      await AsyncStorage.setItem('erp_token', data.token);
      if (data.refreshToken) {
        await AsyncStorage.setItem('erp_refresh_token', data.refreshToken);
      }
      return data.token;
    }
  } catch {}
  return null;
}

export async function gql<T = any>(
  query: string,
  variables?: Record<string, any>,
): Promise<T> {
  let token = await AsyncStorage.getItem('erp_token');

  // Auto-refresh if token is expired or close to expiry
  if (token && isTokenExpired(token)) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      token = refreshed;
    } else {
      // Refresh failed — clear token so app redirects to login
      await AsyncStorage.removeItem('erp_token');
      token = null;
    }
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  // Throw only when there is no data at all (hard failure), not on partial field errors
  if (json.errors?.length && !json.data) throw new Error(json.errors[0].message);
  return json.data as T;
}
