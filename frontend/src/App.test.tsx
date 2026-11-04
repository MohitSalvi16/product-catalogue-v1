import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';
import type { Product } from './api/client';

const electronics = { slug: 'electronics', name: 'electronics' };

function product(id: string, title: string): Product {
  return {
    id,
    title,
    description: `About ${title}`,
    price: 19.5,
    category: electronics,
    imageUrl: `/api/products/${id}/image`,
  };
}

const drive = product('1', 'Hard Drive');
const monitor = product('2', 'Monitor');

type Route = (init?: RequestInit) => { status?: number; body: unknown };

/** Stubs the backend at the network boundary, so pages and the API client run for real. */
function stubApi(overrides: Record<string, Route> = {}) {
  const routes: Record<string, Route> = {
    '/api/categories': () => ({ body: { items: [electronics] } }),
    '/api/products/top-rated': () => ({ body: { items: [drive, monitor] } }),
    '/api/products/1': () => ({ body: drive }),
    ...overrides,
  };
  const fetchStub = vi.fn(async (url: string, init?: RequestInit) => {
    const route = routes[url];
    if (!route) throw new Error(`Unexpected request: ${url}`);
    const { status = 200, body } = route(init);
    return Response.json(body, { status });
  });
  vi.stubGlobal('fetch', fetchStub);
  return fetchStub;
}

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

describe('home page', () => {
  it('shows the featured products', async () => {
    stubApi();
    renderAt('/');

    expect(await screen.findByRole('link', { name: /Hard Drive/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Monitor/ })).toBeInTheDocument();
  });

  it('shows the error when products are unavailable', async () => {
    stubApi({
      '/api/products/top-rated': () => ({
        status: 503,
        body: { error: { code: 'X', message: 'Products are unavailable right now' } },
      }),
    });
    renderAt('/');

    expect(await screen.findByRole('alert')).toHaveTextContent('Products are unavailable');
  });
});

describe('category page', () => {
  it('shows top rated and additional products after clicking a category', async () => {
    stubApi({
      '/api/categories/electronics': () => ({
        body: { category: electronics, topRated: [monitor], others: [drive] },
      }),
    });
    const user = renderAt('/');

    await user.click(await screen.findByRole('link', { name: 'electronics' }));

    const topRated = await screen.findByRole('region', { name: 'Top rated' });
    expect(within(topRated).getByRole('link', { name: /Monitor/ })).toBeInTheDocument();
    const more = screen.getByRole('region', { name: 'More products' });
    expect(within(more).getByRole('link', { name: /Hard Drive/ })).toBeInTheDocument();
  });

  it('explains when the category does not exist', async () => {
    stubApi({ '/api/categories/nope': () => ({ status: 404, body: {} }) });
    renderAt('/categories/nope');

    expect(await screen.findByRole('alert')).toHaveTextContent('could not find that category');
  });
});

describe('search', () => {
  it('shows only the matching products after clicking search', async () => {
    const fetchStub = stubApi({
      '/api/products/search?q=hard%20drive': () => ({ body: { items: [drive] } }),
    });
    const user = renderAt('/');

    await user.type(screen.getByRole('searchbox'), 'hard drive');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByRole('heading', { name: /Results for/ })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Hard Drive/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Monitor/ })).not.toBeInTheDocument();
    expect(fetchStub).toHaveBeenCalledWith('/api/products/search?q=hard%20drive', undefined);
  });

  it('says so when nothing matches', async () => {
    stubApi({ '/api/products/search?q=zzz': () => ({ body: { items: [] } }) });
    renderAt('/search?q=zzz');

    expect(await screen.findByText('No products match your search.')).toBeInTheDocument();
  });

  it('does not search for a blank term', async () => {
    const fetchStub = stubApi();
    const user = renderAt('/');

    await user.type(screen.getByRole('searchbox'), '   ');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(fetchStub).not.toHaveBeenCalledWith(expect.stringContaining('search'), undefined);
  });
});

describe('product page', () => {
  it('opens the details after clicking a product tile', async () => {
    stubApi();
    const user = renderAt('/');

    await user.click(await screen.findByRole('link', { name: /Hard Drive/ }));

    expect(await screen.findByRole('heading', { name: 'Hard Drive' })).toBeInTheDocument();
    expect(screen.getByText('About Hard Drive')).toBeInTheDocument();
    expect(screen.getByText('$19.50')).toBeInTheDocument();
  });
});

describe('enquiry', () => {
  async function completeForm(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('link', { name: 'Enquire' }));
    await user.type(await screen.findByLabelText('Name'), 'Sam Doe');
    await user.type(screen.getByLabelText('Email'), 'sam@example.com');
    await user.click(screen.getByRole('button', { name: 'Send enquiry' }));
  }

  it('submits the contact details and thanks the customer', async () => {
    const received: unknown[] = [];
    stubApi({
      '/api/enquiries': (init) => {
        received.push(JSON.parse(String(init?.body)));
        return { status: 202, body: { status: 'received' } };
      },
    });
    const user = renderAt('/products/1');

    await completeForm(user);

    expect(await screen.findByRole('heading', { name: 'Thank you' })).toBeInTheDocument();
    expect(received).toEqual([
      { productId: '1', name: 'Sam Doe', email: 'sam@example.com', phone: '', message: '' },
    ]);
  });

  it('shows field errors from the server and keeps what was typed', async () => {
    stubApi({
      '/api/enquiries': () => ({
        status: 400,
        body: {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Please check the highlighted fields',
            details: { fieldErrors: { email: ['Please enter a valid email address'] } },
          },
        },
      }),
    });
    const user = renderAt('/products/1');

    await completeForm(user);

    expect(await screen.findByText('Please enter a valid email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Name')).toHaveValue('Sam Doe');
  });

  it('does not say thank you when sending fails', async () => {
    stubApi({
      '/api/enquiries': () => ({
        status: 503,
        body: { error: { code: 'ENQUIRY_NOT_SENT', message: 'We could not send your enquiry' } },
      }),
    });
    const user = renderAt('/products/1');

    await completeForm(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('could not send your enquiry');
    expect(screen.queryByRole('heading', { name: 'Thank you' })).not.toBeInTheDocument();
  });
});
