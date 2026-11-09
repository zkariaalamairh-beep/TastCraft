const configuredUrl = import.meta.env.VITE_API_BASE_URL;

if (!configuredUrl) {
  throw new Error('VITE_API_BASE_URL is missing from .env.local.');
}

const API_BASE_URL = configuredUrl.replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message, status = 0, data = null) {
    super(message);

    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function getErrorMessage(data, status) {
  // Do not show internal server exception details to the user.
  if (status >= 500) {
    return 'The server could not complete the request. Please try again.';
  }

  if (typeof data === 'string' && data.trim()) {
    return data;
  }

  if (typeof data?.message === 'string') {
    return data.message;
  }

  // Supports Identity errors and ASP.NET validation errors.
  if (data?.errors) {
    const errors = Array.isArray(data.errors)
      ? data.errors
      : Object.values(data.errors).flat();

    const messages = errors.filter(
      (message) => typeof message === 'string',
    );

    if (messages.length > 0) {
      return messages.join(' ');
    }
  }

  return data?.title || `Request failed with status ${status}.`;
}

export async function apiRequest(
  path,
  {
    method = 'GET',
    body,
    accessToken,
    csrfToken,
    useCookies = false,
    signal,
  } = {},
) {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new Error('API paths must start with a single slash.');
  }

  // Our cookie authentication endpoints must not receive Bearer tokens.
  if (useCookies && accessToken) {
    throw new Error(
      'Do not combine cookie authentication with an access token.',
    );
  }

  // File uploads travel as multipart bodies untouched.
  const isFormData = body instanceof FormData;

  const headers = {
    Accept: 'application/json',
  };

  // FormData sets its own multipart boundary; never override it.
  if (body !== undefined && !isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  if (csrfToken) {
    headers['X-CSRF-TOKEN'] = csrfToken;
  }

  const options = {
    method,
    headers,
    credentials: useCookies ? 'include' : 'omit',
    cache: 'no-store',
    signal,
  };

  if (isFormData) {
    options.body = body;
  } else if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  let response;
  let responseText;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, options);
    responseText = await response.text();
  } catch (error) {
    // Let the caller handle intentionally cancelled requests.
    if (error.name === 'AbortError') {
      throw error;
    }

    throw new ApiError(
      'Unable to reach the API. Check your connection and try again.',
    );
  }

  let data = null;

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      // Some API errors may be returned as plain text.
      data = responseText;
    }
  }

  if (!response.ok) {
    throw new ApiError(
      getErrorMessage(data, response.status),
      response.status,
      data,
    );
  }

  // Successful responses without a body, such as 204, return null.
  return data;
}