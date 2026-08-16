"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import type { RoomStateEvent } from "@co-op-games/shared";
import WordDuelBoard from "@/components/WordDuelBoard";
import CopyIconButton from "@/components/CopyIconButton";

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = (params.code ?? "").toUpperCase();

  const [state, setState] = useState<RoomStateEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    const socket = getSocket();

    function join() {
      socket.emit("room:join", { code }, (res) => {
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
  }, [code]);

  function handleGuess(guess: string) {
    getSocket().emit("game:action", { code, guess });
  }

  function handleHint() {
    getSocket().emit("game:hint", { code });
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
        <span>You are Player {state.yourSlot}</span>
      </div>

      {state.partnerDisconnected && (
        <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-400/30 rounded-lg px-4 py-2 w-full text-center">
          Your partner disconnected. Waiting for them to rejoin…
        </p>
      )}

      {state.game && (
        <WordDuelBoard
          game={state.game}
          yourSlot={state.yourSlot}
          onGuess={handleGuess}
          onHint={handleHint}
          onRestart={handleRestart}
        />
      )}
    </div>
  );
}
