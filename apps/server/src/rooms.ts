import {
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  getGame,
  type PlayerSlot,
} from "@co-op-games/shared";

interface Room {
  code: string;
  gameId: string;
  gameState: unknown;
  slots: Record<PlayerSlot, string | null>; // socket.id occupying each slot
  names: Record<PlayerSlot, string | null>; // player-chosen display name per slot
  partnerDisconnected: boolean;
  lastActivity: number;
}

const rooms = new Map<string, Room>();

const ROOM_MAX_ATTEMPTS_TO_GENERATE_CODE = 10;
const MAX_NAME_LENGTH = 20;

function sanitizeName(name: string | undefined): string | null {
  const trimmed = name?.trim().slice(0, MAX_NAME_LENGTH);
  return trimmed ? trimmed : null;
}
// Matches the deploy platform's own idle-to-scale-down window (Cloud Run
// scales to zero after ~15 min of no traffic anyway, wiping all in-memory
// state), so cleaning up inactive rooms on the same cadence keeps behavior
// consistent whether the process stays warm or gets recycled.
const INACTIVE_ROOM_TTL_MS = 15 * 60 * 1000; // 15 minutes

export function createRoom(gameId: string): Room | undefined {
  const game = getGame(gameId);
  if (!game) return undefined;

  let code = generateRoomCode();
  for (let i = 0; i < ROOM_MAX_ATTEMPTS_TO_GENERATE_CODE && rooms.has(code); i++) {
    code = generateRoomCode();
  }
  const room: Room = {
    code,
    gameId,
    gameState: game.createInitialState(),
    slots: { 1: null, 2: null },
    names: { 1: null, 2: null },
    partnerDisconnected: false,
    lastActivity: Date.now(),
  };
  rooms.set(code, room);
  return room;
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(normalizeRoomCode(code));
}

export function joinRoom(
  rawCode: string,
  socketId: string,
  name?: string
): { ok: true; room: Room; slot: PlayerSlot } | { ok: false; error: string } {
  const code = normalizeRoomCode(rawCode);
  if (!isValidRoomCode(code)) return { ok: false, error: "That room code doesn't look right." };

  const room = rooms.get(code);
  if (!room) return { ok: false, error: "Room not found — it may have expired from inactivity, or the code is wrong." };

  // If this exact socket already holds a slot (e.g. a duplicate join call
  // from React StrictMode's double-effect in dev), return that slot instead
  // of handing out a second one and starving the real other player.
  const existingSlot: PlayerSlot | undefined = room.slots[1] === socketId ? 1 : room.slots[2] === socketId ? 2 : undefined;
  if (existingSlot !== undefined) {
    room.names[existingSlot] = sanitizeName(name) ?? room.names[existingSlot];
    room.lastActivity = Date.now();
    return { ok: true, room, slot: existingSlot };
  }

  const openSlot: PlayerSlot | undefined = room.slots[1] === null ? 1 : room.slots[2] === null ? 2 : undefined;
  if (openSlot === undefined) return { ok: false, error: "That room is already full." };

  room.slots[openSlot] = socketId;
  room.names[openSlot] = sanitizeName(name);
  room.partnerDisconnected = false;
  room.lastActivity = Date.now();
  return { ok: true, room, slot: openSlot };
}

/** Dispatches a player's action to whichever game module the room is running. */
export function applyGameAction(code: string, slot: PlayerSlot, action: unknown): Room | undefined {
  const room = rooms.get(normalizeRoomCode(code));
  if (!room) return undefined;
  const game = getGame(room.gameId);
  if (!game) return undefined;
  room.gameState = game.applyAction(room.gameState, slot, action);
  room.lastActivity = Date.now();
  return room;
}

export function restartGame(code: string): Room | undefined {
  const room = rooms.get(normalizeRoomCode(code));
  if (!room) return undefined;
  const game = getGame(room.gameId);
  if (!game) return undefined;
  room.gameState = game.createInitialState();
  room.lastActivity = Date.now();
  return room;
}

/** Frees whichever slot this socket held. Returns the room if it still has a player left. */
export function handleDisconnect(socketId: string): Room | undefined {
  for (const room of rooms.values()) {
    let found = false;
    for (const slot of [1, 2] as PlayerSlot[]) {
      if (room.slots[slot] === socketId) {
        room.slots[slot] = null;
        found = true;
      }
    }
    if (found) {
      const anyoneLeft = room.slots[1] !== null || room.slots[2] !== null;
      room.partnerDisconnected = anyoneLeft;
      room.lastActivity = Date.now();
      if (!anyoneLeft) {
        // Nobody left in the room right now; keep it around briefly in case
        // of a quick refresh, but let the sweep clean it up if truly idle.
        return undefined;
      }
      return room;
    }
  }
  return undefined;
}

export function roomStatus(room: Room): "waiting" | "playing" {
  return room.slots[1] !== null && room.slots[2] !== null ? "playing" : "waiting";
}

/**
 * Closes any room — occupied or not — that hasn't seen activity (a join,
 * guess, hint, or restart) within INACTIVE_ROOM_TTL_MS. Simple by design:
 * no separate grace period for occupied rooms, no reconnect notification.
 */
export function sweepInactiveRooms(): void {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.lastActivity > INACTIVE_ROOM_TTL_MS) {
      rooms.delete(code);
    }
  }
}

export type { Room };
