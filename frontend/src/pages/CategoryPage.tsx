import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { api } from '../api/client';
import { ProductGrid } from '../components/ProductGrid';
import { QueryStatus } from '../components/QueryStatus';

export function CategoryPage() {
  const { slug = '' } = useParams();
  const { data, error } = useQuery({
    queryKey: ['category', slug],
    queryFn: () => api.categoryPage(slug),
  });

  if (!data) return <QueryStatus error={error} notFoundMessage="We could not find that category" />;

  return (
    <>
      <h1 className="capitalised">{data.category.name}</h1>
      {data.topRated.length > 0 && (
        <section aria-labelledby="top-rated-heading">
          <h2 id="top-rated-heading">Top rated</h2>
          <ProductGrid products={data.topRated} />
        </section>
      )}
      {data.others.length > 0 && (
        <section aria-labelledby="more-heading">
          <h2 id="more-heading">More products</h2>
          <ProductGrid products={data.others} />
        </section>
      )}
    </>
  );
}
