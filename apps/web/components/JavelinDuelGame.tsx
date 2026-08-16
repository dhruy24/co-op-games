"use client";

import { useEffect, useRef, useState } from "react";
import type { PlayerSlot, JavelinDuelState } from "@co-op-games/shared";
import { MAX_THROWS, bestDistance, getWinner } from "@co-op-games/shared";

type Phase = "angle" | "power" | "runup" | "submitting";

const ANGLE_PERIOD_MS = 1600;
const POWER_FILL_MS = 1500;
const RUNUP_DURATION_MS = 2000;
const SWEET_SPOT = 42;
const SWEET_SPOT_BAND = 6; // +/- degrees shown as the "sweet spot" highlight

interface Props {
  game: JavelinDuelState;
  yourSlot: PlayerSlot;
  onThrow: (angle: number, power: number, timingAccuracy: number, foul: boolean) => void;
  onRestart: () => void;
}

export default function JavelinDuelGame({ game, yourSlot, onThrow, onRestart }: Props) {
  const isYourTurn = game.status === "playing" && game.turn === yourSlot;
  const yourThrowCount = game.throws[yourSlot]?.length ?? 0;

  const [phase, setPhase] = useState<Phase>("angle");
  const [progress, setProgress] = useState(0); // 0..1 within the current phase's animation
  const lockedAngleRef = useRef<number | null>(null);
  const lockedPowerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const submittedRef = useRef(false);

  // Reset the local mini-game each time it becomes your turn for a new throw.
  useEffect(() => {
    if (isYourTurn) {
      setPhase("angle");
      setProgress(0);
      lockedAngleRef.current = null;
      lockedPowerRef.current = null;
      submittedRef.current = false;
    }
    // yourThrowCount changing means a new throw slot opened up for you.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isYourTurn, yourThrowCount]);

  // Drives the active phase's animation loop.
  useEffect(() => {
    if (!isYourTurn || phase === "submitting") return;

    startRef.current = performance.now();
    const duration = phase === "angle" ? ANGLE_PERIOD_MS : phase === "power" ? POWER_FILL_MS : RUNUP_DURATION_MS;

    function tick(now: number) {
      const elapsed = now - startRef.current;

      if (phase === "runup" && elapsed >= duration) {
        // The runner crossed the foul line before a throw was released.
        if (!submittedRef.current) {
          submittedRef.current = true;
          setPhase("submitting");
          onThrow(lockedAngleRef.current ?? 0, lockedPowerRef.current ?? 0, 0, true);
        }
        return;
      }

      setProgress(Math.min(1, elapsed / duration));
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isYourTurn]);

  function currentAngle(): number {
    // Triangle wave: 0 -> 90 -> 0 over one period.
    return progress < 0.5 ? progress * 2 * 90 : (1 - progress) * 2 * 90;
  }

  function currentPower(): number {
    return progress * 100;
  }

  function handleAngleClick() {
    if (phase !== "angle") return;
    lockedAngleRef.current = currentAngle();
    setPhase("power");
    setProgress(0);
  }

  function handlePowerClick() {
    if (phase !== "power") return;
    lockedPowerRef.current = currentPower();
    setPhase("runup");
    setProgress(0);
  }

  function handleThrowClick() {
    if (phase !== "runup" || submittedRef.current) return;
    submittedRef.current = true;
    setPhase("submitting");
    onThrow(lockedAngleRef.current ?? 0, lockedPowerRef.current ?? 0, progress, false);
  }

  const showInteractiveGame = isYourTurn && phase !== "submitting";
  const winner = getWinner(game);

  return (
    <div className="flex flex-col gap-6 items-center w-full">
      {game.status === "playing" && (
        <>
          {showInteractiveGame ? (
            <div className="flex flex-col gap-4 items-center w-full">
              <p className="text-sm text-slate-300">
                Throw {yourThrowCount + 1} of {MAX_THROWS} —{" "}
                {phase === "angle" && "click to lock your angle"}
                {phase === "power" && "click to lock your power"}
                {phase === "runup" && "click Throw! before you cross the line"}
              </p>

              {phase === "angle" && (
                <div className="w-full flex flex-col gap-2">
                  <div className="relative h-8 bg-white/5 rounded-full border border-white/10 overflow-hidden">
                    <div
                      className="absolute top-0 bottom-0 bg-correct/20"
                      style={{
                        left: `${Math.max(0, SWEET_SPOT - SWEET_SPOT_BAND)}%`,
                        width: `${SWEET_SPOT_BAND * 2}%`,
                      }}
                    />
                    <div
                      className="absolute top-1 bottom-1 w-2 rounded-full bg-indigo-400"
                      style={{ left: `calc(${currentAngle()}% - 4px)` }}
                    />
                  </div>
                  <button
                    onClick={handleAngleClick}
                    className="bg-indigo-500 hover:bg-indigo-400 transition rounded-lg py-3 font-medium"
                  >
                    Lock Angle
                  </button>
                </div>
              )}

              {phase === "power" && (
                <div className="w-full flex flex-col gap-2">
                  <div className="relative h-8 bg-white/5 rounded-full border border-white/10 overflow-hidden">
                    <div
                      className="absolute top-0 bottom-0 left-0 bg-indigo-500/40"
                      style={{ width: `${currentPower()}%` }}
                    />
                  </div>
                  <button
                    onClick={handlePowerClick}
                    className="bg-indigo-500 hover:bg-indigo-400 transition rounded-lg py-3 font-medium"
                  >
                    Lock Power
                  </button>
                </div>
              )}

              {phase === "runup" && (
                <div className="w-full flex flex-col gap-2">
                  <div className="relative h-8 bg-white/5 rounded-full border border-white/10 overflow-hidden">
                    <div className="absolute top-0 bottom-0 right-0 w-1 bg-rose-400" />
                    <div
                      className="absolute top-1 bottom-1 w-2 rounded-full bg-indigo-400"
                      style={{ left: `calc(${progress * 100}% - 4px)` }}
                    />
                  </div>
                  <button
                    onClick={handleThrowClick}
                    className="bg-rose-500 hover:bg-rose-400 transition rounded-lg py-3 font-bold"
                  >
                    Throw!
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-300">
              {phase === "submitting" ? "Throw submitted, waiting for result…" : "Your partner is throwing…"}
            </p>
          )}
        </>
      )}

      <div className="w-full flex flex-col gap-3">
        {([1, 2] as PlayerSlot[]).map((slot) => (
          <div key={slot} className="bg-white/5 rounded-lg border border-white/10 px-4 py-3">
            <div className="flex items-center justify-between text-sm text-slate-300 mb-1">
              <span>{slot === yourSlot ? "You" : "Partner"}</span>
              <span>Best: {bestDistance(game, slot).toFixed(1)}m</span>
            </div>
            <div className="flex gap-2">
              {game.throws[slot]?.map((t, i) => (
                <span
                  key={i}
                  className={`text-xs px-2 py-1 rounded-md font-mono ${
                    t.foul ? "bg-rose-500/20 text-rose-300" : "bg-white/10 text-slate-200"
                  }`}
                >
                  {t.foul ? "FOUL" : `${t.distance.toFixed(1)}m`}
                </span>
              ))}
              {Array.from({ length: MAX_THROWS - (game.throws[slot]?.length ?? 0) }).map((_, i) => (
                <span key={`empty-${i}`} className="text-xs px-2 py-1 rounded-md bg-white/5 text-slate-500 font-mono">
                  —
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {game.status === "finished" && (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-xl font-bold">
            {winner === "tie"
              ? "🤝 It's a tie!"
              : winner === yourSlot
                ? "🏆 You threw farther!"
                : "🏆 Your partner threw farther!"}
          </p>
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
