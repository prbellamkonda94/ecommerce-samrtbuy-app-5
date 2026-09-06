// Fixed catalog fixtures from shared/catalog.js. products is never
// truncated by global-setup.ts (only reseeded/upserted), so tests can key
// off these stable ids/prices/stock rather than discovering them at
// runtime.
export const HEADPHONES = { id: 1, name: 'Wireless Noise-Cancelling Headphones', price: 129.99 };
export const BEANIE = { id: 9, name: 'Unisex Wool Beanie', price: 14.99 };
export const ROBOT_VACUUM = { id: 15, name: 'Robot Vacuum Cleaner', price: 189.0, stock: 12 };
export const ATOMIC_HABITS = { id: 19, name: 'Atomic Habits', price: 16.99 };
export const MIDNIGHT_LIBRARY = { id: 20, name: 'The Midnight Library', price: 13.5 };

export const BOOKS_CATEGORY = 'Books';
export const BOOKS_COUNT = 4; // ids 19-22

export const VALID_SHIPPING = {
  fullName: 'Jamie Rivera',
  address: '123 Test Ave',
  city: 'Springfield',
  zip: '90210',
  cardNumber: '4242424242424242',
};
