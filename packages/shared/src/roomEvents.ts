import type { PlayerSlot } from "./gameModule.js";
import type { WordDuelClientState } from "./games/wordDuel.js";

/** Events the client emits to the server. */
export interface ClientToServerEvents {
  "room:create": (cb: (res: { code: string }) => void) => void;
  "room:join": (
    payload: { code: string },
    cb: (res: { ok: true; slot: PlayerSlot } | { ok: false; error: string }) => void
  ) => void;
  "game:action": (payload: { code: string; guess: string }) => void;
  "game:hint": (payload: { code: string }) => void;
  "game:restart": (payload: { code: string }) => void;
}

export type RoomStatus = "waiting" | "playing";

export interface RoomStateEvent {
  status: RoomStatus;
  yourSlot: PlayerSlot;
  playersConnected: number;
  game: WordDuelClientState | null;
  partnerDisconnected: boolean;
}

/** Events the server emits to clients. */
export interface ServerToClientEvents {
  "room:state": (state: RoomStateEvent) => void;
  "room:error": (payload: { message: string }) => void;
}
