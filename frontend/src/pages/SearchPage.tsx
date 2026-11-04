import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { api } from '../api/client';
import { ProductGrid } from '../components/ProductGrid';
import { QueryStatus } from '../components/QueryStatus';

export function SearchPage() {
  const [params] = useSearchParams();
  const term = params.get('q')?.trim() ?? '';
  const { data: products, error } = useQuery({
    queryKey: ['search', term],
    queryFn: () => api.search(term),
    enabled: term !== '',
  });

  if (!term) return <p>Enter a search term to find products.</p>;

  return (
    <>
      <h1>Results for “{term}”</h1>
      {!products && <QueryStatus error={error} />}
      {products?.length === 0 && <p>No products match your search.</p>}
      {products && <ProductGrid products={products} />}
    </>
  );
}
