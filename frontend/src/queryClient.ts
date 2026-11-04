import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api/client';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        // Retrying a 404 or a validation error cannot change the answer.
        retry: (failures, error) =>
          failures < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
      },
    },
  });
}
