import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@co-op-games/shared";

// Falls back to localhost only if the env var is truly unset/blank — an
// empty string would otherwise make socket.io-client silently connect to
// the current page's own origin instead of the real WebSocket server.
const WS_URL = process.env.NEXT_PUBLIC_WS_URL?.trim() || "http://localhost:4000";

if (typeof window !== "undefined" && !process.env.NEXT_PUBLIC_WS_URL?.trim()) {
  console.warn(
    "[co-op-games] NEXT_PUBLIC_WS_URL is not set — falling back to http://localhost:4000. " +
      "Set it in your deployment's environment variables to point at your real server."
  );
}

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

/** Lazily creates a single shared socket connection for the browser tab. */
export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (!socket) {
    socket = io(WS_URL, { autoConnect: true });
  }
  return socket;
}
