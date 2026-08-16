import { createServer } from "node:http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { toClientState, type PlayerSlot } from "@co-op-games/shared";
import {
  createRoom,
  joinRoom,
  applyGuess,
  useHint,
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
  for (const slot of [1, 2] as PlayerSlot[]) {
    const socketId = room.slots[slot];
    if (!socketId) continue;
    io.to(socketId).emit("room:state", {
      status,
      yourSlot: slot,
      playersConnected: (room.slots[1] !== null ? 1 : 0) + (room.slots[2] !== null ? 1 : 0),
      game: toClientState(room.gameState),
      partnerDisconnected: room.partnerDisconnected,
    });
  }
}

io.on("connection", (socket) => {
  socket.on("room:create", (cb) => {
    const room = createRoom();
    cb({ code: room.code });
  });

  socket.on("room:join", ({ code }, cb) => {
    const result = joinRoom(code, socket.id);
    if (!result.ok) {
      cb(result);
      return;
    }
    socket.join(result.room.code);
    socketRoomMap.set(socket.id, { code: result.room.code, slot: result.slot });
    cb({ ok: true, slot: result.slot });
    broadcastRoomState(result.room);
  });

  // applyGuess/useHint/restartGame only return undefined when the room
  // itself is gone (expired/never existed) — a rejected-but-valid action
  // (wrong turn, bad word, etc.) still returns the room unchanged, so an
  // undefined result here specifically means "tell the player to restart".
  socket.on("game:action", ({ code, guess }) => {
    const entry = socketRoomMap.get(socket.id);
    if (!entry || entry.code !== code) return;
    const room = applyGuess(code, entry.slot, guess);
    if (room) broadcastRoomState(room);
    else socket.emit("room:error", { message: SESSION_EXPIRED_MESSAGE });
  });

  socket.on("game:hint", ({ code }) => {
    const entry = socketRoomMap.get(socket.id);
    if (!entry || entry.code !== code) return;
    const room = useHint(code, entry.slot);
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
