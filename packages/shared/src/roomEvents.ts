import type { PlayerSlot } from "./gameModule.js";

/** Events the client emits to the server. */
export interface ClientToServerEvents {
  "room:create": (payload: { gameId: string }, cb: (res: { ok: true; code: string } | { ok: false; error: string }) => void) => void;
  "room:join": (
    payload: { code: string; name?: string },
    cb: (res: { ok: true; slot: PlayerSlot } | { ok: false; error: string }) => void
  ) => void;
  /** `action` is opaque here — its shape is defined per-game (see each game's *Action type). */
  "game:action": (payload: { code: string; action: unknown }) => void;
  "game:restart": (payload: { code: string }) => void;
}

export type RoomStatus = "waiting" | "playing";

export interface RoomStateEvent {
  status: RoomStatus;
  yourSlot: PlayerSlot;
  playersConnected: number;
  /** `state` is opaque here — its shape is defined per-game (see each game's *ClientState type). */
  game: { gameId: string; state: unknown } | null;
  partnerDisconnected: boolean;
  /** Player-chosen display names, if set — null for a slot that's empty or whose player skipped naming themselves. */
  names: Record<PlayerSlot, string | null>;
}

/** Events the server emits to clients. */
export interface ServerToClientEvents {
  "room:state": (state: RoomStateEvent) => void;
  "room:error": (payload: { message: string }) => void;
}
