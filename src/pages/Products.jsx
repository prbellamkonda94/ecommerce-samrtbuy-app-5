import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CATEGORIES } from '../../shared/catalog.js';
import { useProducts } from '../context/ProductsContext';
import ProductCard from '../components/ProductCard';

export default function Products() {
  const { products, loading, error } = useProducts();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const category = searchParams.get('category') || '';
  const [sort, setSort] = useState('relevance');

  const setCategory = (cat) => {
    const next = new URLSearchParams(searchParams);
    if (cat) next.set('category', cat);
    else next.delete('category');
    setSearchParams(next);
  };

  const filtered = useMemo(() => {
    let list = products.filter((p) => {
      const matchesQuery = query
        ? p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.description.toLowerCase().includes(query.toLowerCase())
        : true;
      const matchesCategory = category ? p.category === category : true;
      return matchesQuery && matchesCategory;
    });

    if (sort === 'price-asc') list = [...list].sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') list = [...list].sort((a, b) => b.price - a.price);
    if (sort === 'rating') list = [...list].sort((a, b) => b.rating - a.rating);

    return list;
  }, [products, query, category, sort]);

  return (
    <div className="container">
      <div className="products-layout">
        <aside className="sidebar">
          <h3>Category</h3>
          <ul className="filter-list">
            <li>
              <button
                className={!category ? 'filter-active' : ''}
                onClick={() => setCategory('')}
              >
                All
              </button>
            </li>
            {CATEGORIES.map((cat) => (
              <li key={cat}>
                <button
                  className={category === cat ? 'filter-active' : ''}
                  onClick={() => setCategory(cat)}
                >
                  {cat}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="products-main">
          <div className="products-toolbar">
            <p>
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
              {query ? ` for "${query}"` : ''}
            </p>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="relevance">Sort: Relevance</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="rating">Top Rated</option>
            </select>
          </div>

          {error && <p className="empty-state">Couldn't load products: {error}</p>}
          {loading && !error && <p className="empty-state">Loading products…</p>}
          {!loading && !error && filtered.length === 0 && (
            <p className="empty-state">No products found. Try a different search or category.</p>
          )}
          {!loading && !error && filtered.length > 0 && (
            <div className="product-grid">
              {filtered.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
