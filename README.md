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
so more can be added without touching the networking/room code. Currently:

- **Word Duel** (`wordDuel.ts`) — a shared Wordle-style puzzle, players alternate guesses.
- **Memory Match** (`memoryMatch.ts`) — a shared card grid, players take turns flipping pairs.
- **Javelin Duel** (`javelinDuel.ts`) — an angle/power/timing skill minigame, 3 throws each,
  farthest throw wins. The only competitive (not co-op) game so far, and the only one where
  the client runs a real-time animation — it submits raw inputs (angle/power/timing), and the
  server scores the throw via a shared pure function, keeping `applyAction` deterministic like
  every other game.

The room/server layer is game-agnostic: it dispatches player actions to whichever
game module a room is running via a small registry (`registerGame`/`getGame` in
`gameModule.ts`), so the client picks a game when creating a room and the server
never needs game-specific code.

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

Every game's rules are pure functions with unit tests:

```bash
npm run test -w packages/shared
```

## Deploying

- **`apps/web`** → [Vercel](https://vercel.com), as a standard Next.js app (root
  directory `apps/web`). Set `NEXT_PUBLIC_WS_URL` to your deployed server's URL.
- **`apps/server`** → a container platform that keeps a process running
  continuously (needed for persistent WebSocket connections) — currently deployed
  on [Google Cloud Run](https://cloud.google.com/run) via the root `Dockerfile`;
  [Railway](https://railway.app) or [Render](https://render.com) also work fine.
  Set `CLIENT_ORIGIN` to your deployed web app's URL so CORS allows it. If using
  Cloud Run, pin `--max-instances 1` — room state lives in a single process's
  memory, so multiple instances would split rooms across processes.

Room state is kept in memory on the server (no database), so a server restart
(or Cloud Run scaling to zero) clears any in-progress rooms. Rooms are also
auto-closed after 15 minutes of inactivity either way — see `sweepInactiveRooms`
in `apps/server/src/rooms.ts`.

## Adding a new game

1. Add a new module under `packages/shared/src/games/` implementing the
   `GameModule<State, Action, ClientState>` interface from
   `packages/shared/src/gameModule.ts`. Only define `toClientState` if the game
   has something to hide mid-game (an answer, unflipped cards, etc.) — it
   defaults to passing state straight through otherwise.
2. Register it with `registerGame(...)` and export it from
   `packages/shared/src/index.ts` (see how Word Duel and Memory Match do both).
3. Add it to the `GAMES` list in `apps/web/app/page.tsx` (the game picker) and
   build a board component in `apps/web/components/`, following
   `MemoryMatchBoard.tsx` or `WordDuelBoard.tsx`. Wire it into
   `apps/web/app/room/[code]/page.tsx`'s `gameId` switch.

No server-side code needs to change for a new game — the room/action dispatch
is already generic.
