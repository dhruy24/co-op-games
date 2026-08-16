"use client";

import type { PlayerSlot, MemoryMatchClientState } from "@co-op-games/shared";

interface Props {
  game: MemoryMatchClientState;
  yourSlot: PlayerSlot;
  partnerName?: string | null;
  onFlip: (index: number) => void;
  onRestart: () => void;
}

export default function MemoryMatchBoard({ game, yourSlot, partnerName, onFlip, onRestart }: Props) {
  const isYourTurn = game.status === "playing" && game.turn === yourSlot;

  return (
    <div className="flex flex-col gap-6 items-center">
      <div className="grid grid-cols-4 gap-2">
        {game.cards.map((card, i) => {
          const faceUp = card.matched || card.value !== null;
          const canFlip = isYourTurn && !card.matched && card.value === null;
          return (
            <button
              key={i}
              type="button"
              onClick={() => canFlip && onFlip(i)}
              disabled={!canFlip}
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-lg border-2 flex items-center justify-center text-2xl transition ${
                card.matched
                  ? "border-correct bg-correct/20"
                  : faceUp
                    ? "border-indigo-400 bg-indigo-500/10"
                    : "border-white/15 bg-white/5 hover:bg-white/10 disabled:hover:bg-white/5"
              }`}
            >
              {faceUp ? card.value : ""}
            </button>
          );
        })}
      </div>

      {game.status === "playing" && (
        <p className="text-sm text-slate-300">
          {isYourTurn ? "Your turn — flip a card" : "Waiting for your partner…"}
        </p>
      )}

      <div className="flex gap-6 text-sm text-slate-300">
        <span>You've found: {game.scores[yourSlot]}</span>
        <span>{partnerName ?? "Partner"}&apos;s found: {game.scores[yourSlot === 1 ? 2 : 1]}</span>
      </div>

      {game.status === "won" && (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-xl font-bold">🎉 You cleared the board together!</p>
          <button
            onClick={onRestart}
            className="bg-indigo-500 hover:bg-indigo-400 transition rounded-lg px-5 py-2.5 font-medium"
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}
