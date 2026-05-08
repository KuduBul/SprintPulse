'use client';

import { useCallback } from 'react';

interface ApiResponse<T = unknown> {
  data?: T;
  error?: { code: string; message: string; details?: unknown };
  status: number;
}

/**
 * Custom hook for making authenticated API calls.
 * Session cookies are sent automatically by the browser — no explicit token header needed.
 */
export function useApi() {
  const request = useCallback(
    async <T = unknown>(
      url: string,
      options: RequestInit = {}
    ): Promise<ApiResponse<T>> => {
      const headers: Record<string, string> = {
        ...(options.headers as Record<string, string>),
      };

      // Only set Content-Type for non-FormData requests
      if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
      }

      try {
        const response = await fetch(url, {
          ...options,
          headers,
        });

        const status = response.status;

        if (status === 204) {
          return { status, data: undefined };
        }

        const body = await response.json();

        if (!response.ok) {
          return { status, error: body.error };
        }

        return { status, data: body as T };
      } catch (err) {
        return {
          status: 0,
          error: {
            code: 'NETWORK_ERROR',
            message: err instanceof Error ? err.message : 'Network error',
          },
        };
      }
    },
    []
  );

  const get = useCallback(
    <T = unknown>(url: string) => request<T>(url, { method: 'GET' }),
    [request]
  );

  const post = useCallback(
    <T = unknown>(url: string, body?: unknown) =>
      request<T>(url, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      }),
    [request]
  );

  const patch = useCallback(
    <T = unknown>(url: string, body?: unknown) =>
      request<T>(url, {
        method: 'PATCH',
        body: body ? JSON.stringify(body) : undefined,
      }),
    [request]
  );

  const del = useCallback(
    <T = unknown>(url: string) => request<T>(url, { method: 'DELETE' }),
    [request]
  );

  return { get, post, patch, del, request, isLoaded: true };
}
