// Ports distinct from the app's normal dev ports (Vite's 5173, API's 3001)
// so `npm test` in e2e/ can run alongside a developer's own `npm run dev`
// without colliding.
export const BACKEND_PORT = 8811;
export const FRONTEND_PORT = 4310;
