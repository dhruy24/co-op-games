"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { isValidRoomCode, normalizeRoomCode } from "@co-op-games/shared";

export default function HomePage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function handleCreateRoom() {
    setCreating(true);
    setError(null);
    getSocket().emit("room:create", ({ code }) => {
      setCreating(false);
      router.push(`/room/${code}`);
    });
  }

  function handleJoinRoom(e: React.FormEvent) {
    e.preventDefault();
    const code = normalizeRoomCode(joinCode);
    if (!isValidRoomCode(code)) {
      setError("Enter the 5-character code your partner shared with you.");
      return;
    }
    setError(null);
    router.push(`/room/${code}`);
  }

  return (
    <div className="flex flex-col gap-8 mt-8">
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Co-op Games</h1>
        <p className="mt-2 text-slate-300">
          Simple 2-player games you play together, online. Create a room, share the
          link, and play in the browser — no accounts needed.
        </p>
      </header>

      <section className="bg-white/5 rounded-xl p-6 flex flex-col gap-3 border border-white/10">
        <h2 className="font-semibold text-lg">Start a new game</h2>
        <button
          onClick={handleCreateRoom}
          disabled={creating}
          className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 transition rounded-lg py-3 font-medium"
        >
          {creating ? "Creating room…" : "Create Room"}
        </button>
      </section>

      <section className="bg-white/5 rounded-xl p-6 flex flex-col gap-3 border border-white/10">
        <h2 className="font-semibold text-lg">Have a room code?</h2>
        <form onSubmit={handleJoinRoom} className="flex flex-col gap-3">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="e.g. AB3XZ"
            maxLength={5}
            className="bg-slate-900/60 border border-white/10 rounded-lg px-4 py-3 tracking-[0.3em] text-center uppercase font-mono"
          />
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <button
            type="submit"
            className="bg-white/10 hover:bg-white/20 transition rounded-lg py-3 font-medium"
          >
            Join Room
          </button>
        </form>
      </section>

      <p className="text-center text-sm text-slate-400">
        First game: <span className="font-medium text-slate-200">Word Duel</span> — a
        shared Wordle-style puzzle you solve together, taking turns.
      </p>
    </div>
  );
}
