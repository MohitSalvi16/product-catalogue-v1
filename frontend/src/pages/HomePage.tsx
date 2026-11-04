import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { ProductGrid } from '../components/ProductGrid';
import { QueryStatus } from '../components/QueryStatus';

export function HomePage() {
  const { data: products, error } = useQuery({ queryKey: ['top-rated'], queryFn: api.topRated });

  return (
    <>
      <h1>Top rated</h1>
      {products ? <ProductGrid products={products} /> : <QueryStatus error={error} />}
    </>
  );
}
