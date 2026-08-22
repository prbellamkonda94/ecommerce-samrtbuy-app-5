import { Link } from 'react-router-dom';
import StarRating from './StarRating';
import { useCart } from '../context/CartContext';

export default function ProductCard({ product }) {
  const { addToCart } = useCart();

  return (
    <div className="product-card">
      <Link to={`/products/${product.id}`} className="product-card-media" style={{ background: product.color }}>
        <span className="product-emoji">{product.emoji}</span>
      </Link>
      <div className="product-card-body">
        <span className="product-category">{product.category}</span>
        <Link to={`/products/${product.id}`} className="product-name">
          {product.name}
        </Link>
        <StarRating rating={product.rating} />
        <div className="product-card-footer">
          <span className="product-price">${product.price.toFixed(2)}</span>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => addToCart(product.id, 1)}
            disabled={product.stock === 0}
          >
            {product.stock === 0 ? 'Out of stock' : 'Add to cart'}
          </button>
        </div>
      </div>
    </div>
  );
}
