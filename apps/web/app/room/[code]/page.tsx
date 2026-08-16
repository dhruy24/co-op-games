"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { getSavedPlayerName, savePlayerName } from "@/lib/playerName";
import type { RoomStateEvent, WordDuelClientState, MemoryMatchClientState, JavelinDuelState } from "@co-op-games/shared";
import { WORD_DUEL_ID, MEMORY_MATCH_ID, JAVELIN_DUEL_ID } from "@co-op-games/shared";
import WordDuelBoard from "@/components/WordDuelBoard";
import MemoryMatchBoard from "@/components/MemoryMatchBoard";
import JavelinDuelGame from "@/components/JavelinDuelGame";
import CopyIconButton from "@/components/CopyIconButton";

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = (params.code ?? "").toUpperCase();

  const [state, setState] = useState<RoomStateEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // Player name: asked for every time a room is entered (via a quick gate
  // below) before we ever connect — pre-filled with whatever was used last
  // so returning players just confirm rather than retype.
  const [playerName, setPlayerName] = useState("");
  const [nameReady, setNameReady] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  useEffect(() => {
    const saved = getSavedPlayerName();
    if (saved) setNameDraft(saved);
  }, []);

  useEffect(() => {
    if (!nameReady) return; // hold off connecting until the name gate is dismissed
    const socket = getSocket();

    function join() {
      socket.emit("room:join", { code, name: playerName || undefined }, (res) => {
        if (!res.ok) {
          setError(res.error);
        }
      });
    }

    function onState(next: RoomStateEvent) {
      setError(null);
      setState(next);
    }

    function onError(payload: { message: string }) {
      setError(payload.message);
    }

    socket.on("room:state", onState);
    socket.on("room:error", onError);
    socket.on("connect", join);
    if (socket.connected) join();

    return () => {
      socket.off("room:state", onState);
      socket.off("room:error", onError);
      socket.off("connect", join);
    };
  }, [code, nameReady, playerName]);

  function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = nameDraft.trim();
    if (trimmed) savePlayerName(trimmed);
    setPlayerName(trimmed);
    setNameReady(true);
  }

  function handleGuess(guess: string) {
    getSocket().emit("game:action", { code, action: { type: "guess", guess } });
  }

  function handleHint() {
    getSocket().emit("game:action", { code, action: { type: "hint" } });
  }

  function handleFlip(index: number) {
    getSocket().emit("game:action", { code, action: { type: "flip", index } });
  }

  function handleThrow(angle: number, power: number, timingAccuracy: number, foul: boolean) {
    getSocket().emit("game:action", { code, action: { type: "throw", angle, power, timingAccuracy, foul } });
  }

  function handleRestart() {
    getSocket().emit("game:restart", { code });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable — user can still copy the URL manually.
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1500);
    } catch {
      // Clipboard API unavailable — user can still copy the code manually.
    }
  }

  if (!nameReady) {
    const canJoin = nameDraft.trim().length > 0;
    return (
      <div className="flex flex-col items-center gap-6 mt-16 text-center">
        <h1 className="text-2xl font-bold">Before you join…</h1>
        <p className="text-slate-300">What should your partner see you as? (optional)</p>
        <form onSubmit={handleNameSubmit} className="flex flex-col gap-3 w-full">
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            placeholder="Your name"
            maxLength={20}
            autoFocus
            className="bg-slate-900/60 border border-white/10 rounded-lg px-4 py-3 text-center"
          />
          <button
            type="submit"
            className={`rounded-lg py-3 font-medium transition ${
              canJoin ? "bg-indigo-500 hover:bg-indigo-400" : "bg-white/10 hover:bg-white/20"
            }`}
          >
            {canJoin ? "Join Room" : "Join without a name"}
          </button>
        </form>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 mt-16 text-center">
        <p className="text-rose-300">{error}</p>
        <button
          onClick={() => router.push("/")}
          className="bg-white/10 hover:bg-white/20 transition rounded-lg px-5 py-2.5 font-medium"
        >
          Back to home
        </button>
      </div>
    );
  }

  if (!state) {
    return <p className="text-center mt-16 text-slate-300">Connecting…</p>;
  }

  const partnerSlot = state.yourSlot === 1 ? 2 : 1;
  const yourDisplayName = state.names[state.yourSlot] ?? `Player ${state.yourSlot}`;
  const partnerDisplayName = state.names[partnerSlot];

  if (state.status === "waiting") {
    return (
      <div className="flex flex-col items-center gap-6 mt-12 text-center">
        <h1 className="text-2xl font-bold">Waiting for your partner…</h1>
        <p className="text-slate-300">Share this link or code so they can join:</p>
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg pl-4 pr-3 py-4">
          <CopyIconButton copied={codeCopied} onClick={copyCode} label="Copy room code" />
          <span className="font-mono text-3xl tracking-[0.3em]">{code}</span>
        </div>
        <button
          onClick={copyLink}
          className="bg-indigo-500 hover:bg-indigo-400 transition rounded-lg px-5 py-2.5 font-medium"
        >
          {copied ? "Link copied!" : "Copy invite link"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 items-center mt-4">
      <div className="w-full flex items-center justify-between text-sm text-slate-300">
        <span className="flex items-center gap-1">
          <CopyIconButton copied={codeCopied} onClick={copyCode} label="Copy room code" />
          Room <span className="font-mono">{code}</span>
        </span>
        <span className="text-right">
          <div>You: {yourDisplayName}</div>
          {partnerDisplayName && <div className="text-slate-400">vs {partnerDisplayName}</div>}
        </span>
      </div>

      {state.partnerDisconnected && (
        <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-400/30 rounded-lg px-4 py-2 w-full text-center">
          {partnerDisplayName ?? "Your partner"} disconnected. Waiting for them to rejoin…
        </p>
      )}

      {state.game?.gameId === WORD_DUEL_ID && (
        <WordDuelBoard
          game={state.game.state as WordDuelClientState}
          yourSlot={state.yourSlot}
          onGuess={handleGuess}
          onHint={handleHint}
          onRestart={handleRestart}
        />
      )}

      {state.game?.gameId === MEMORY_MATCH_ID && (
        <MemoryMatchBoard
          game={state.game.state as MemoryMatchClientState}
          yourSlot={state.yourSlot}
          partnerName={partnerDisplayName}
          onFlip={handleFlip}
          onRestart={handleRestart}
        />
      )}

      {state.game?.gameId === JAVELIN_DUEL_ID && (
        <JavelinDuelGame
          game={state.game.state as JavelinDuelState}
          yourSlot={state.yourSlot}
          partnerName={partnerDisplayName}
          onThrow={handleThrow}
          onRestart={handleRestart}
        />
      )}
    </div>
  );
}
