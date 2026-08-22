import 'dotenv/config';
import { sql } from './db.js';
import { PRODUCTS } from '../shared/catalog.js';

async function seed() {
  console.log('Creating tables (if not present)...');

  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price NUMERIC(10,2) NOT NULL,
      emoji TEXT NOT NULL,
      color TEXT NOT NULL,
      description TEXT NOT NULL,
      rating NUMERIC(2,1) NOT NULL,
      stock INTEGER NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      subtotal NUMERIC(10,2) NOT NULL,
      shipping_cost NUMERIC(10,2) NOT NULL,
      total NUMERIC(10,2) NOT NULL,
      shipping_full_name TEXT NOT NULL,
      shipping_address TEXT NOT NULL,
      shipping_city TEXT NOT NULL,
      shipping_zip TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Confirmed',
      placed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      name TEXT NOT NULL,
      price NUMERIC(10,2) NOT NULL,
      qty INTEGER NOT NULL
    )
  `;

  console.log(`Seeding ${PRODUCTS.length} products...`);

  for (const p of PRODUCTS) {
    await sql`
      INSERT INTO products (id, name, category, price, emoji, color, description, rating, stock)
      VALUES (${p.id}, ${p.name}, ${p.category}, ${p.price}, ${p.emoji}, ${p.color}, ${p.description}, ${p.rating}, ${p.stock})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        price = EXCLUDED.price,
        emoji = EXCLUDED.emoji,
        color = EXCLUDED.color,
        description = EXCLUDED.description,
        rating = EXCLUDED.rating,
        stock = EXCLUDED.stock
    `;
  }

  console.log('Seed complete.');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
