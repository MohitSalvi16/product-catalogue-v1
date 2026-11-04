import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { api } from '../api/client';
import { ProductImage } from '../components/ProductImage';
import { QueryStatus } from '../components/QueryStatus';
import { formatPrice } from '../format';

export function ProductPage() {
  const { id = '' } = useParams();
  const { data: product, error } = useQuery({
    queryKey: ['product', id],
    queryFn: () => api.product(id),
  });

  if (!product) return <QueryStatus error={error} notFoundMessage="We could not find that product" />;

  return (
    <article className="product-details">
      <ProductImage product={product} />
      <div>
        <Link to={`/categories/${product.category.slug}`} className="capitalised">
          {product.category.name}
        </Link>
        <h1>{product.title}</h1>
        <p className="product-details__price">{formatPrice(product.price)}</p>
        <p>{product.description}</p>
        <Link to={`/products/${product.id}/enquire`} className="button">
          Enquire
        </Link>
      </div>
    </article>
  );
}
