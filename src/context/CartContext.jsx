import { createContext, useContext, useMemo } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useProducts } from './ProductsContext';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useLocalStorage('smartbuy_cart', []); // [{ productId, qty }]
  const { getProductById } = useProducts();

  const addToCart = (productId, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.productId === productId);
      if (existing) {
        return prev.map((item) =>
          item.productId === productId ? { ...item, qty: item.qty + qty } : item
        );
      }
      return [...prev, { productId, qty }];
    });
  };

  const updateQty = (productId, qty) => {
    if (qty <= 0) {
      removeFromCart(productId);
      return;
    }
    setItems((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, qty } : item))
    );
  };

  const removeFromCart = (productId) => {
    setItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  const clearCart = () => setItems([]);

  const cartDetails = useMemo(
    () =>
      items
        .map((item) => {
          const product = getProductById(item.productId);
          if (!product) return null;
          return { ...item, product };
        })
        .filter(Boolean),
    [items, getProductById]
  );

  const itemCount = useMemo(() => items.reduce((sum, i) => sum + i.qty, 0), [items]);

  const subtotal = useMemo(
    () => cartDetails.reduce((sum, i) => sum + i.product.price * i.qty, 0),
    [cartDetails]
  );

  const value = {
    items,
    cartDetails,
    itemCount,
    subtotal,
    addToCart,
    updateQty,
    removeFromCart,
    clearCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
