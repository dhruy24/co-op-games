# Builds and runs the realtime WebSocket server (apps/server) for deployment
# to a container platform like Google Cloud Run. The Next.js frontend
# (apps/web) is NOT included here — it deploys separately to Vercel.
#
# The whole monorepo is copied in (rather than just apps/server) because
# apps/server depends on the @co-op-games/shared workspace package, and npm
# workspaces need the full workspace tree present to link it correctly.
FROM node:24-slim

WORKDIR /app

COPY . .

RUN npm install --omit=optional

ENV NODE_ENV=production
# Cloud Run injects its own PORT env var at runtime and expects the
# container to listen on it — apps/server already reads process.env.PORT.
EXPOSE 4000

CMD ["npm", "run", "start", "-w", "apps/server"]
