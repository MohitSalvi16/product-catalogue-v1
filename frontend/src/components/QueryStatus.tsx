import { ApiError } from '../api/client';

interface QueryStatusProps {
  error: Error | null;
  notFoundMessage?: string;
}

/** The loading and failure states shared by every page. */
export function QueryStatus({ error, notFoundMessage = 'Page not found' }: QueryStatusProps) {
  if (!error) return <p role="status">Loading…</p>;

  // A malformed id in the URL is a 400, but to a customer that page simply does not exist.
  const notFound = error instanceof ApiError && [400, 404].includes(error.status);
  return <p role="alert">{notFound ? notFoundMessage : error.message}</p>;
}
