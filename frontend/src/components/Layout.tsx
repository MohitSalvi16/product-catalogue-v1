import { useQuery } from '@tanstack/react-query';
import { Link, NavLink, Outlet, useSearchParams } from 'react-router';
import { api } from '../api/client';
import { SearchBar } from './SearchBar';

export function Layout() {
  const [params] = useSearchParams();
  const term = params.get('q') ?? '';
  // A failed category list only costs the nav: search and pages still work.
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: api.categories });

  return (
    <>
      <header className="site-header">
        <div className="site-header__row">
          <Link to="/" className="site-header__brand">
            Catalogue
          </Link>
          <SearchBar key={term} initialTerm={term} />
        </div>
        <nav aria-label="Categories" className="site-nav">
          {categories.map(({ slug, name }) => (
            <NavLink key={slug} to={`/categories/${slug}`} className="site-nav__link">
              {name}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="site-main">
        <Outlet />
      </main>
    </>
  );
}
