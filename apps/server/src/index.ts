import { createServer } from "node:http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { getGame, getClientState, type PlayerSlot } from "@co-op-games/shared";
import {
  createRoom,
  joinRoom,
  applyGameAction,
  restartGame,
  handleDisconnect,
  roomStatus,
  sweepInactiveRooms,
  getRoom,
  type Room,
} from "./rooms.js";

const PORT = Number(process.env.PORT ?? 4000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:3000";

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.get("/health", (_req, res) => res.json({ ok: true }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGIN },
});

// Tracks which room/slot each connected socket currently occupies.
const socketRoomMap = new Map<string, { code: string; slot: PlayerSlot }>();

const SESSION_EXPIRED_MESSAGE = "This game session expired due to inactivity. Start a new game to keep playing.";

function broadcastRoomState(room: Room) {
  const status = roomStatus(room);
  const game = getGame(room.gameId);
  for (const slot of [1, 2] as PlayerSlot[]) {
    const socketId = room.slots[slot];
    if (!socketId) continue;
    io.to(socketId).emit("room:state", {
      status,
      yourSlot: slot,
      playersConnected: (room.slots[1] !== null ? 1 : 0) + (room.slots[2] !== null ? 1 : 0),
      game: game ? { gameId: room.gameId, state: getClientState(game, room.gameState) } : null,
      partnerDisconnected: room.partnerDisconnected,
      names: room.names,
    });
  }
}

io.on("connection", (socket) => {
  socket.on("room:create", ({ gameId }, cb) => {
    const room = createRoom(gameId);
    if (!room) {
      cb({ ok: false, error: "Unknown game." });
      return;
    }
    cb({ ok: true, code: room.code });
  });

  socket.on("room:join", ({ code, name }, cb) => {
    const result = joinRoom(code, socket.id, name);
    if (!result.ok) {
      cb(result);
      return;
    }
    socket.join(result.room.code);
    socketRoomMap.set(socket.id, { code: result.room.code, slot: result.slot });
    cb({ ok: true, slot: result.slot });
    broadcastRoomState(result.room);
  });

  // applyGameAction/restartGame only return undefined when the room itself
  // is gone (expired/never existed) — a rejected-but-valid action (wrong
  // turn, bad guess, etc.) still returns the room unchanged, so an
  // undefined result here specifically means "tell the player to restart".
  socket.on("game:action", ({ code, action }) => {
    const entry = socketRoomMap.get(socket.id);
    if (!entry || entry.code !== code) return;
    const room = applyGameAction(code, entry.slot, action);
    if (room) broadcastRoomState(room);
    else socket.emit("room:error", { message: SESSION_EXPIRED_MESSAGE });
  });

  socket.on("game:restart", ({ code }) => {
    const entry = socketRoomMap.get(socket.id);
    if (!entry || entry.code !== code) return;
    const room = restartGame(code);
    if (room) broadcastRoomState(room);
    else socket.emit("room:error", { message: SESSION_EXPIRED_MESSAGE });
  });

  socket.on("disconnect", () => {
    const entry = socketRoomMap.get(socket.id);
    socketRoomMap.delete(socket.id);
    if (!entry) return;
    const room = handleDisconnect(socket.id) ?? getRoom(entry.code);
    if (room) broadcastRoomState(room);
  });
});

setInterval(sweepInactiveRooms, 5 * 60 * 1000).unref();

httpServer.listen(PORT, () => {
  console.log(`co-op-games server listening on :${PORT} (CORS origin: ${CLIENT_ORIGIN})`);
});
