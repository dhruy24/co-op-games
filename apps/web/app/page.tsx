"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import {
  isValidRoomCode,
  normalizeRoomCode,
  WORD_DUEL_ID,
  MEMORY_MATCH_ID,
  JAVELIN_DUEL_ID,
} from "@co-op-games/shared";

const GAMES = [
  {
    id: WORD_DUEL_ID,
    name: "Word Duel",
    description: "A shared Wordle-style puzzle you solve together, taking turns.",
  },
  {
    id: MEMORY_MATCH_ID,
    name: "Memory Match",
    description: "Flip cards together to clear the board and find every pair.",
  },
  {
    id: JAVELIN_DUEL_ID,
    name: "Javelin Duel",
    description: "Pick your angle, power, and timing — whoever throws farther wins.",
  },
];

export default function HomePage() {
  const router = useRouter();
  const [selectedGame, setSelectedGame] = useState(GAMES[0].id);
  const [joinCode, setJoinCode] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function handleCreateRoom() {
    setCreating(true);
    setCreateError(null);
    getSocket().emit("room:create", { gameId: selectedGame }, (res) => {
      setCreating(false);
      if (!res.ok) {
        setCreateError(res.error);
        return;
      }
      router.push(`/room/${res.code}`);
    });
  }

  function handleJoinRoom(e: React.FormEvent) {
    e.preventDefault();
    const code = normalizeRoomCode(joinCode);
    if (!isValidRoomCode(code)) {
      setJoinError("Enter the 5-character code your partner shared with you.");
      return;
    }
    setJoinError(null);
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
        <div className="flex flex-col gap-2">
          {GAMES.map((game) => (
            <button
              key={game.id}
              type="button"
              onClick={() => setSelectedGame(game.id)}
              className={`text-left rounded-lg px-4 py-3 border transition ${
                selectedGame === game.id
                  ? "border-indigo-400 bg-indigo-500/10"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              <div className="font-medium">{game.name}</div>
              <div className="text-sm text-slate-400">{game.description}</div>
            </button>
          ))}
        </div>
        <button
          onClick={handleCreateRoom}
          disabled={creating}
          className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 transition rounded-lg py-3 font-medium"
        >
          {creating ? "Creating room…" : "Create Room"}
        </button>
        {createError && <p className="text-sm text-rose-300">{createError}</p>}
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
          {joinError && <p className="text-sm text-rose-300">{joinError}</p>}
          <button
            type="submit"
            className="bg-white/10 hover:bg-white/20 transition rounded-lg py-3 font-medium"
          >
            Join Room
          </button>
        </form>
      </section>
    </div>
  );
}
