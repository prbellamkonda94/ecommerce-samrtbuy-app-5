import { Link } from 'react-router-dom';
import { CATEGORIES } from '../../shared/catalog.js';
import { useProducts } from '../context/ProductsContext';
import ProductCard from '../components/ProductCard';

const CATEGORY_EMOJI = {
  Electronics: '💻',
  Fashion: '👕',
  'Home & Kitchen': '🏠',
  Books: '📚',
  'Sports & Outdoors': '🏕️',
  'Beauty & Personal Care': '💄',
};

export default function Home() {
  const { products, loading, error } = useProducts();
  const featured = products.filter((p) => p.rating >= 4.5).slice(0, 8);

  return (
    <div className="container">
      <section className="hero">
        <div>
          <h1>Everything you need, delivered to your door.</h1>
          <p>Browse thousands of items across electronics, fashion, home, and more.</p>
          <Link to="/products" className="btn btn-primary">Start Shopping</Link>
        </div>
      </section>

      <section className="section">
        <h2>Shop by Category</h2>
        <div className="category-grid">
          {CATEGORIES.map((cat) => (
            <Link key={cat} to={`/products?category=${encodeURIComponent(cat)}`} className="category-tile">
              <span className="category-emoji">{CATEGORY_EMOJI[cat]}</span>
              <span>{cat}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>Top Rated Picks</h2>
          <Link to="/products">View all →</Link>
        </div>
        {error && <p className="empty-state">Couldn't load products: {error}</p>}
        {loading && !error && <p className="empty-state">Loading products…</p>}
        {!loading && !error && (
          <div className="product-grid">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
