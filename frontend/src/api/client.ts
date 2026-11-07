export interface Category {
  slug: string;
  name: string;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  category: Category;
  imageUrl: string;
}

export interface CategoryPage {
  category: Category;
  topRated: Product[];
  others: Product[];
}

export interface EnquiryRequest {
  productId: string;
  name: string;
  email: string;
  phone: string;
  message: string;
}

export type FieldErrors = Partial<Record<string, string[]>>;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fieldErrors: FieldErrors = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, init);
  } catch {
    throw new ApiError(0, 'We could not reach the server. Please check your connection');
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      body?.error?.message ?? 'Something went wrong',
      body?.error?.details?.fieldErrors,
    );
  }
  return body as T;
}

const items = <T>(path: string) => request<{ items: T[] }>(path).then((body) => body.items);

export const api = {
  categories: () => items<Category>('/categories'),
  categoryPage: (slug: string) => request<CategoryPage>(`/categories/${encodeURIComponent(slug)}`),
  topRated: () => items<Product>('/products/top-rated'),
  search: (term: string) => items<Product>(`/products/search?q=${encodeURIComponent(term)}`),
  product: (id: string) => request<Product>(`/products/${encodeURIComponent(id)}`),
  submitEnquiry: (enquiry: EnquiryRequest) =>
    request<{ status: string }>('/enquiries', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(enquiry),
    }),
};
