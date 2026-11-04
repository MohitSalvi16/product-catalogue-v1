import { Link } from 'react-router';
import type { Product } from '../api/client';
import { formatPrice } from '../format';
import { ProductImage } from './ProductImage';

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <ul className="product-grid">
      {products.map((product) => (
        <li key={product.id}>
          <Link to={`/products/${product.id}`} className="product-tile">
            <ProductImage product={product} />
            <span className="product-tile__title">{product.title}</span>
            <span className="product-tile__price">{formatPrice(product.price)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
