# Co-op Games

A website for simple 2-player co-op games you play online with a partner or friend —
create a room, share the link, and play together in the browser. No accounts needed.

## Project structure

```
apps/
  web/       Next.js frontend (App Router)
  server/    Node + Socket.IO realtime server (room management, game state sync)
packages/
  shared/    Shared TypeScript types + game logic, used by both apps
```

Games are implemented as small, pure "game modules" in `packages/shared/src/games/`
(see `wordDuel.ts` for the first game) so more can be added without touching the
networking/room code.

## Local development

Requires Node.js 24+ (see `.nvmrc`).

```bash
npm install
npm run dev
```

This starts both the WebSocket server (`:4000`) and the Next.js app (`:3000`)
together. Open `http://localhost:3000` in two browser windows (or one normal +
one incognito) to simulate two players: create a room in the first, then paste
the room link into the second.

Copy the env example files if you need to override defaults:

```bash
cp apps/web/.env.local.example apps/web/.env.local
cp apps/server/.env.example apps/server/.env
```

## Testing the game logic

The Word Duel game rules are pure functions with unit tests:

```bash
npm run test -w packages/shared
```

## Deploying

- **`apps/web`** → deploy to [Vercel](https://vercel.com) as a standard Next.js
  app. Set `NEXT_PUBLIC_WS_URL` to your deployed server's URL.
- **`apps/server`** → deploy to [Railway](https://railway.app) or
  [Render](https://render.com) as a long-running Node service (`npm run start -w apps/server`).
  Set `CLIENT_ORIGIN` to your deployed web app's URL so CORS allows it.

Room state is kept in memory on the server (no database), so a server restart
clears any in-progress rooms. That's fine for the MVP; add persistence later if
needed.

## Adding a new game

1. Add a new module under `packages/shared/src/games/` implementing the
   `GameModule<State, Action>` interface from `packages/shared/src/gameModule.ts`.
2. Export it from `packages/shared/src/index.ts`.
3. Wire it into the room/server layer and build a board component in `apps/web`,
   following the pattern used for Word Duel.
