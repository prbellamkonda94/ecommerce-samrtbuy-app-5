import { Router } from 'express';
import { sql } from '../db.js';

const router = Router();

// Postgres NUMERIC columns come back as strings to avoid float rounding;
// the frontend expects numbers, so cast them at the API boundary.
function formatProduct(p) {
  return { ...p, price: Number(p.price), rating: Number(p.rating) };
}

router.get('/', async (req, res, next) => {
  try {
    const products = await sql`SELECT * FROM products ORDER BY id`;
    res.json(products.map(formatProduct));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid product id' });
    }
    const [product] = await sql`SELECT * FROM products WHERE id = ${id}`;
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(formatProduct(product));
  } catch (err) {
    next(err);
  }
});

export default router;
