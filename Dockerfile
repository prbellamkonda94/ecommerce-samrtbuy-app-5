# syntax=docker/dockerfile:1

# --- Build stage: compile the Vite frontend into dist/ --------------------
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Runtime stage: prod-only deps + the built frontend + the API server --
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY shared ./shared
COPY --from=build /app/dist ./dist

EXPOSE 3001
# Single-artifact deploy: server/index.js serves both the API and, since
# dist/ exists in this image, the built frontend from the same process
# (see CLAUDE.md's Deployment section) -- matches how Render runs this app.
CMD ["node", "--import", "./server/otel/instrumentation.mjs", "server/index.js"]
