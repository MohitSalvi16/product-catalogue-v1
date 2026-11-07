import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';

export function SearchBar({ initialTerm }: { initialTerm: string }) {
  const [term, setTerm] = useState(initialTerm);
  const navigate = useNavigate();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = term.trim();
    if (trimmed) navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form role="search" className="search-bar" onSubmit={handleSubmit}>
      <input
        type="search"
        aria-label="Search products"
        placeholder="Search products"
        maxLength={100}
        value={term}
        onChange={(event) => setTerm(event.target.value)}
      />
      <button type="submit" className="button">
        Search
      </button>
    </form>
  );
}
