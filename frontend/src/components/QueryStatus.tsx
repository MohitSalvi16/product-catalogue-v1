import { ApiError } from '../api/client';

interface QueryStatusProps {
  error: Error | null;
  notFoundMessage?: string;
}

/** The loading and failure states shared by every page. */
export function QueryStatus({ error, notFoundMessage = 'Page not found' }: QueryStatusProps) {
  if (!error) return <p role="status">Loading…</p>;

  const notFound = error instanceof ApiError && error.status === 404;
  return <p role="alert">{notFound ? notFoundMessage : error.message}</p>;
}
