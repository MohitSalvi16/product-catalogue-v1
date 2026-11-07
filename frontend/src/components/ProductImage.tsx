import { useState } from 'react';
import type { Product } from '../api/client';

export function ProductImage({ product }: { product: Product }) {
  const [failed, setFailed] = useState(false);

  if (failed) return <div className="product-image product-image--missing">No image</div>;
  return (
    <img
      className="product-image"
      src={product.imageUrl}
      alt={product.title}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
