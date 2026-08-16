"use client";

import { useState } from "react";
import type { PlayerSlot, WordDuelClientState, LetterStatus } from "@co-op-games/shared";
import { MAX_ATTEMPTS, isValidGuessWord } from "@co-op-games/shared";

const STATUS_CLASSES: Record<LetterStatus, string> = {
  correct: "bg-correct border-correct text-slate-900",
  present: "bg-present border-present text-slate-900",
  absent: "bg-absent border-absent text-white",
};

interface Props {
  game: WordDuelClientState;
  yourSlot: PlayerSlot;
  onGuess: (guess: string) => void;
  onHint: () => void;
  onRestart: () => void;
}

export default function WordDuelBoard({ game, yourSlot, onGuess, onHint, onRestart }: Props) {
  const [draft, setDraft] = useState("");
  const [guessError, setGuessError] = useState<string | null>(null);
  const isYourTurn = game.status === "playing" && game.turn === yourSlot;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isYourTurn) return;
    const guess = draft.trim().toUpperCase();
    if (guess.length !== 5) return;
    if (!isValidGuessWord(guess)) {
      setGuessError(`"${guess}" isn't a word we know — try another.`);
      return;
    }
    setGuessError(null);
    onGuess(guess);
    setDraft("");
  }

  const emptyRows = Math.max(0, game.maxAttempts - game.rows.length);

  return (
    <div className="flex flex-col gap-6 items-center">
      <div className="flex flex-col gap-1.5">
        {game.rows.map((row, i) => (
          <div key={i} className="flex gap-1.5">
            {row.guess.split("").map((letter, j) => (
              <div
                key={j}
                className={`w-12 h-12 flex items-center justify-center rounded-md border-2 font-bold text-xl uppercase ${STATUS_CLASSES[row.statuses[j]]}`}
              >
                {letter}
              </div>
            ))}
          </div>
        ))}
        {Array.from({ length: emptyRows }).map((_, i) => (
          <div key={`empty-${i}`} className="flex gap-1.5">
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className="w-12 h-12 rounded-md border-2 border-white/15" />
            ))}
          </div>
        ))}
      </div>

      {game.hints.length > 0 && (
        <div className="flex gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => {
            const hint = game.hints.find((h) => h.index === i);
            return (
              <div
                key={i}
                className="w-12 h-12 flex items-center justify-center rounded-md border-2 border-dashed border-amber-300/60 text-amber-200 font-bold text-xl uppercase"
              >
                {hint?.letter ?? ""}
              </div>
            );
          })}
        </div>
      )}

      {game.status === "playing" && (
        <>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <p>
              {isYourTurn ? "Your turn — guess a 5-letter word" : "Waiting for your partner's guess…"}
              <span className="ml-2 text-slate-400">
                ({game.attemptsRemaining}/{MAX_ATTEMPTS} attempts left)
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onHint}
            disabled={game.hintsRemaining === 0}
            className="text-sm bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition rounded-lg px-4 py-2 font-medium text-amber-200 border border-amber-400/30 -mt-2"
          >
            💡 {game.hintsRemaining > 0 ? `Use Hint (${game.hintsRemaining} left)` : "No hints left"}
          </button>
          <form onSubmit={submit} className="flex flex-col gap-2 w-full">
            <div className="flex gap-2 w-full">
              <input
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase());
                  setGuessError(null);
                }}
                maxLength={5}
                disabled={!isYourTurn}
                placeholder="?????"
                className="flex-1 bg-slate-900/60 border border-white/10 rounded-lg px-4 py-3 tracking-[0.3em] text-center uppercase font-mono disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!isYourTurn || draft.length !== 5}
                className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 transition rounded-lg px-5 font-medium"
              >
                Guess
              </button>
            </div>
            {guessError && <p className="text-sm text-rose-300 text-center">{guessError}</p>}
          </form>
        </>
      )}

      {game.status !== "playing" && (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-xl font-bold">
            {game.status === "won" ? "🎉 You solved it together!" : "😢 Out of attempts"}
          </p>
          {game.answer && (
            <p className="text-slate-300">
              The word was <span className="font-mono font-bold text-white">{game.answer}</span>
            </p>
          )}
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
