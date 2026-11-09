import { apiRequest, ApiError } from './api.js';

// Access tokens remain in memory only.
let accessToken = null;
let expiresAt = 0;
let sessionVersion = 0;

let snapshot = {
  status: 'loading',
  user: null,
  error: null,
};

const listeners = new Set();

let refreshPromise = null;
let initializationPromise = null;

function publish(nextSnapshot) {
  snapshot = nextSnapshot;

  listeners.forEach((listener) => listener());
}

function clearSession(status = 'anonymous', error = null) {
  accessToken = null;
  expiresAt = 0;
  sessionVersion += 1;

  publish({
    status,
    user: null,
    error,
  });
}

function saveSession(data) {
  const expiration = Date.parse(data?.expiresAtUtc);

  if (
    typeof data?.accessToken !== 'string' ||
    !data.accessToken ||
    !data?.user?.id ||
    !Number.isFinite(expiration)
  ) {
    throw new ApiError(
      'The API returned an invalid authentication response.',
      502,
    );
  }

  // Prevent old requests from being retried as another account.
  if (snapshot.user?.id !== data.user.id) {
    sessionVersion += 1;
  }

  accessToken = data.accessToken;
  expiresAt = expiration;

  publish({
    status: 'authenticated',
    user: data.user,
    error: null,
  });

  return accessToken;
}

export function getAuthSnapshot() {
  return snapshot;
}

export function subscribeAuth(listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

// Serialize cookie operations across tabs of the same app origin.
// This prevents concurrent refresh-token rotation.
function withCookieLock(action) {
  if (!navigator.locks) {
    return Promise.reject(
      new ApiError(
        'Open the app over HTTPS in an up-to-date browser.',
      ),
    );
  }

  return navigator.locks.request(
    'tastecraft-auth-cookie',
    action,
  );
}

// These endpoints use cookies and CSRF, never a Bearer token.
async function cookiePost(path, body) {
  const csrf = await apiRequest('/auth/csrf', {
    useCookies: true,
  });

  if (!csrf?.csrfToken) {
    throw new ApiError('Unable to initialize CSRF protection.');
  }

  return apiRequest(path, {
    method: 'POST',
    body,
    useCookies: true,
    csrfToken: csrf.csrfToken,
  });
}

function refreshSession() {
  // Requests in this tab share the same refresh operation.
  if (!refreshPromise) {
    refreshPromise = withCookieLock(async () => {
      try {
        const data = await cookiePost('/auth/refresh');

        return saveSession(data);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          clearSession();
        }

        throw error;
      }
    }).finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

// Restore the session once when the application starts.
export function initializeAuth() {
  if (!initializationPromise) {
    initializationPromise = refreshSession().catch((error) => {
      // A refresh 401 already changed the state to anonymous.
      // Other startup failures should remain visible to the UI.
      if (snapshot.status === 'loading') {
        clearSession('error', error.message);
      }
    });
  }

  return initializationPromise;
}

// Allow the UI to retry after a connection/startup error.
export function retrySession() {
  if (snapshot.status !== 'error') {
    return initializeAuth();
  }

  initializationPromise = null;

  publish({
    status: 'loading',
    user: null,
    error: null,
  });

  return initializeAuth();
}

export async function login(credentials) {
  await initializeAuth();

  return withCookieLock(async () => {
    const data = await cookiePost('/auth/login', credentials);

    // A new login starts a different local session,
    // even when it belongs to the same user.
    sessionVersion += 1;

    saveSession(data);

    return data.user;
  });
}

export async function logout() {
  await initializeAuth();

  return withCookieLock(async () => {
    await cookiePost('/auth/logout');

    // Clear local state only after server logout succeeds.
    clearSession();
  });
}

async function getValidAccessToken() {
  if (refreshPromise) {
    return refreshPromise;
  }

  // Refresh shortly before the access token expires.
  if (accessToken && Date.now() < expiresAt - 30_000) {
    return accessToken;
  }

  return refreshSession();
}

function ensureSameSession(expectedVersion) {
  if (
    sessionVersion !== expectedVersion ||
    !accessToken
  ) {
    throw new ApiError(
      'Your session changed. Please try again.',
      401,
    );
  }
}

// Use this function for endpoints requiring Bearer authentication.
export async function authRequest(path, options = {}) {
  await initializeAuth();

  if (snapshot.status === 'error') {
    throw new ApiError(
      snapshot.error || 'Unable to restore your session.',
    );
  }

  if (
    snapshot.status !== 'authenticated' ||
    !accessToken
  ) {
    throw new ApiError('Please sign in to continue.', 401);
  }

  const expectedVersion = sessionVersion;

  let token = await getValidAccessToken();

  ensureSameSession(expectedVersion);

  let result;

  try {
    result = await apiRequest(path, {
      ...options,
      accessToken: token,
    });
  } catch (error) {
    // Never refresh for 403, validation errors or network errors.
    if (error.status !== 401) {
      throw error;
    }

    ensureSameSession(expectedVersion);

    // Another request may already have refreshed the token.
    if (accessToken === token) {
      token = await refreshSession();
    } else {
      token = await getValidAccessToken();
    }

    ensureSameSession(expectedVersion);

    // Retry the original request once only.
    try {
      result = await apiRequest(path, {
        ...options,
        accessToken: token,
      });
    } catch (retryError) {
      if (
        retryError.status === 401 &&
        sessionVersion === expectedVersion &&
        accessToken === token
      ) {
        clearSession();
      }

      throw retryError;
    }
  }

  // Do not return an old account's response after a local account change.
  ensureSameSession(expectedVersion);

  return result;
}
// POST /api/auth/change-password — revokes all sessions.
export async function changePassword(payload) {
  return authRequest('/auth/change-password', {
    method: 'POST',
    body: payload,
  });
}