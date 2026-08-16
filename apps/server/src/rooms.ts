import {
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  wordDuelGame,
  type PlayerSlot,
  type WordDuelState,
} from "@co-op-games/shared";

interface Room {
  code: string;
  gameState: WordDuelState;
  slots: Record<PlayerSlot, string | null>; // socket.id occupying each slot
  partnerDisconnected: boolean;
  lastActivity: number;
}

const rooms = new Map<string, Room>();

const ROOM_MAX_ATTEMPTS_TO_GENERATE_CODE = 10;
const INACTIVE_ROOM_TTL_MS = 30 * 60 * 1000; // 30 minutes

export function createRoom(): Room {
  let code = generateRoomCode();
  for (let i = 0; i < ROOM_MAX_ATTEMPTS_TO_GENERATE_CODE && rooms.has(code); i++) {
    code = generateRoomCode();
  }
  const room: Room = {
    code,
    gameState: wordDuelGame.createInitialState(),
    slots: { 1: null, 2: null },
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
  socketId: string
): { ok: true; room: Room; slot: PlayerSlot } | { ok: false; error: string } {
  const code = normalizeRoomCode(rawCode);
  if (!isValidRoomCode(code)) return { ok: false, error: "That room code doesn't look right." };

  const room = rooms.get(code);
  if (!room) return { ok: false, error: "Room not found. Check the code and try again." };

  // If this exact socket already holds a slot (e.g. a duplicate join call
  // from React StrictMode's double-effect in dev), return that slot instead
  // of handing out a second one and starving the real other player.
  const existingSlot: PlayerSlot | undefined = room.slots[1] === socketId ? 1 : room.slots[2] === socketId ? 2 : undefined;
  if (existingSlot !== undefined) {
    room.lastActivity = Date.now();
    return { ok: true, room, slot: existingSlot };
  }

  const openSlot: PlayerSlot | undefined = room.slots[1] === null ? 1 : room.slots[2] === null ? 2 : undefined;
  if (openSlot === undefined) return { ok: false, error: "That room is already full." };

  room.slots[openSlot] = socketId;
  room.partnerDisconnected = false;
  room.lastActivity = Date.now();
  return { ok: true, room, slot: openSlot };
}

export function applyGuess(code: string, slot: PlayerSlot, guess: string): Room | undefined {
  const room = rooms.get(normalizeRoomCode(code));
  if (!room) return undefined;
  room.gameState = wordDuelGame.applyAction(room.gameState, slot, { type: "guess", guess });
  room.lastActivity = Date.now();
  return room;
}

export function useHint(code: string, slot: PlayerSlot): Room | undefined {
  const room = rooms.get(normalizeRoomCode(code));
  if (!room) return undefined;
  room.gameState = wordDuelGame.applyAction(room.gameState, slot, { type: "hint" });
  room.lastActivity = Date.now();
  return room;
}

export function restartGame(code: string): Room | undefined {
  const room = rooms.get(normalizeRoomCode(code));
  if (!room) return undefined;
  room.gameState = wordDuelGame.createInitialState();
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

export function sweepInactiveRooms(): void {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    const empty = room.slots[1] === null && room.slots[2] === null;
    if (empty && now - room.lastActivity > INACTIVE_ROOM_TTL_MS) {
      rooms.delete(code);
    }
  }
}

export type { Room };
