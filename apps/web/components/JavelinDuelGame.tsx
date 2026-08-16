"use client";

import { useEffect, useRef, useState } from "react";
import type { PlayerSlot, JavelinDuelState, ThrowResult } from "@co-op-games/shared";
import { MAX_THROWS, bestDistance, getWinner } from "@co-op-games/shared";

type Phase = "angle" | "power" | "runup" | "waiting";

const ANGLE_PERIOD_MS = 1600;
const POWER_FILL_MS = 1500;
const RUNUP_DURATION_MS = 1800;
const SWEET_SPOT = 42;
const SWEET_SPOT_BAND = 6; // +/- degrees shown as the highlighted "sweet spot" zone

// Field layout, all as % of the scene's width/height.
const RUNNER_START_PCT = 6;
const FOUL_LINE_PCT = 22;
const FIELD_MAX_METERS = 50; // scales the ground so a perfect throw (~40m) doesn't touch the edge
const GROUND_PCT = 14; // where feet/javelin rest, as % up from the bottom of the scene
const LANDED_DISPLAY_MS = 1400; // how long the landed marker lingers before the next turn's UI appears

interface ActiveFlight {
  slot: PlayerSlot;
  throwResult: ThrowResult;
  startedAt: number;
}

interface Props {
  game: JavelinDuelState;
  yourSlot: PlayerSlot;
  onThrow: (angle: number, power: number, timingAccuracy: number, foul: boolean) => void;
  onRestart: () => void;
}

function landingXPct(distance: number): number {
  const t = Math.max(0, Math.min(1, distance / FIELD_MAX_METERS));
  return FOUL_LINE_PCT + t * (96 - FOUL_LINE_PCT);
}

function flightDurationMs(distance: number): number {
  return 500 + Math.min(distance, FIELD_MAX_METERS) * 10;
}

export default function JavelinDuelGame({ game, yourSlot, onThrow, onRestart }: Props) {
  const isYourTurn = game.status === "playing" && game.turn === yourSlot;
  const yourThrowCount = game.throws[yourSlot]?.length ?? 0;

  const [phase, setPhase] = useState<Phase>("angle");
  const [progress, setProgress] = useState(0); // 0..1 within the current interactive phase
  const lockedAngleRef = useRef<number | null>(null);
  const lockedPowerRef = useRef<number | null>(null);
  const submittedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  // Flight animation state — driven purely by `game.throws` changes, so both
  // players (thrower and partner) see the exact same replay once the
  // server confirms a throw, regardless of who submitted it.
  const [activeFlight, setActiveFlight] = useState<ActiveFlight | null>(null);
  const [flightT, setFlightT] = useState(0); // 0..1 progress through the current flight
  const seenCountsRef = useRef<Record<PlayerSlot, number> | null>(null);
  const flightRafRef = useRef<number | null>(null);

  // Track which throws we've already animated so we don't replay history on
  // mount/reconnect — only newly-arrived throws trigger a flight.
  useEffect(() => {
    if (seenCountsRef.current === null) {
      seenCountsRef.current = { 1: game.throws[1]?.length ?? 0, 2: game.throws[2]?.length ?? 0 };
      return;
    }
    const seen = seenCountsRef.current;
    for (const slot of [1, 2] as PlayerSlot[]) {
      const count = game.throws[slot]?.length ?? 0;
      if (count > seen[slot]) {
        const throwResult = game.throws[slot][count - 1];
        seen[slot] = count;
        setActiveFlight({ slot, throwResult, startedAt: performance.now() });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.throws[1]?.length, game.throws[2]?.length]);

  // Drive the flight animation.
  useEffect(() => {
    if (!activeFlight) return;
    const duration = activeFlight.throwResult.foul ? 500 : flightDurationMs(activeFlight.throwResult.distance);

    function tick(now: number) {
      const elapsed = now - activeFlight!.startedAt;
      const t = Math.min(1, elapsed / duration);
      setFlightT(t);
      if (t < 1) {
        flightRafRef.current = requestAnimationFrame(tick);
      } else {
        setTimeout(() => setActiveFlight(null), LANDED_DISPLAY_MS);
      }
    }
    flightRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (flightRafRef.current !== null) cancelAnimationFrame(flightRafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFlight]);

  // Reset the local interactive mini-game each time it becomes your turn.
  useEffect(() => {
    if (isYourTurn) {
      setPhase("angle");
      setProgress(0);
      lockedAngleRef.current = null;
      lockedPowerRef.current = null;
      submittedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isYourTurn, yourThrowCount]);

  // Drive the angle/power/run-up interactive animation loop.
  useEffect(() => {
    if (!isYourTurn || phase === "waiting" || activeFlight) return;

    startRef.current = performance.now();
    const duration = phase === "angle" ? ANGLE_PERIOD_MS : phase === "power" ? POWER_FILL_MS : RUNUP_DURATION_MS;

    function tick(now: number) {
      const elapsed = now - startRef.current;

      if (phase === "runup") {
        // The run-up is a one-shot dash to the line, not a looping meter —
        // it stops (and auto-fouls) once it reaches the end.
        if (elapsed >= duration) {
          if (!submittedRef.current) {
            submittedRef.current = true;
            setPhase("waiting");
            onThrow(lockedAngleRef.current ?? 0, lockedPowerRef.current ?? 0, 0, true);
          }
          return;
        }
        setProgress(elapsed / duration);
      } else {
        // Angle/power meters sweep back and forth continuously until the
        // player locks one in — wrap the elapsed time into a repeating
        // 0..1 cycle instead of clamping it, so the needle/bar keeps moving.
        const cycles = elapsed / duration;
        setProgress(cycles - Math.floor(cycles));
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isYourTurn, activeFlight]);

  // Both meters are triangle waves (up then back down) so they oscillate
  // continuously rather than filling once and stopping.
  function currentAngle(): number {
    return progress < 0.5 ? progress * 2 * 90 : (1 - progress) * 2 * 90;
  }

  function currentPower(): number {
    return progress < 0.5 ? progress * 2 * 100 : (1 - progress) * 2 * 100;
  }

  function handleAngleLock() {
    if (phase !== "angle") return;
    lockedAngleRef.current = currentAngle();
    setPhase("power");
    setProgress(0);
  }

  function handlePowerLock() {
    if (phase !== "power") return;
    lockedPowerRef.current = currentPower();
    setPhase("runup");
    setProgress(0);
  }

  function handleThrowClick() {
    if (phase !== "runup" || submittedRef.current) return;
    submittedRef.current = true;
    setPhase("waiting");
    onThrow(lockedAngleRef.current ?? 0, lockedPowerRef.current ?? 0, progress, false);
  }

  // --- Derived visuals ---
  const winner = getWinner(game);
  const showControls = isYourTurn && game.status === "playing" && !activeFlight;

  // Runner position: mid-run during the run-up phase, otherwise standing at the start mark.
  const runnerPct = showControls && phase === "runup" ? RUNNER_START_PCT + progress * (FOUL_LINE_PCT - RUNNER_START_PCT) : RUNNER_START_PCT;
  const runnerEmoji = showControls && phase === "runup" ? "🏃" : "🧍";

  // Javelin flight math.
  let javelinVisible = false;
  let javelinXPct = FOUL_LINE_PCT;
  let javelinBottomPct = GROUND_PCT;
  let javelinRotationDeg = 0;
  let showFoulBanner = false;
  let landedLabel: { xPct: number; text: string; isFoul: boolean } | null = null;

  if (activeFlight) {
    const { throwResult } = activeFlight;
    if (throwResult.foul) {
      showFoulBanner = flightT < 1;
      if (flightT >= 1) landedLabel = { xPct: FOUL_LINE_PCT, text: "FOUL", isFoul: true };
    } else {
      const landingPct = landingXPct(throwResult.distance);
      const peakHeightPct = 12 + (throwResult.angle / 90) * 22;
      javelinVisible = true;
      javelinXPct = FOUL_LINE_PCT + flightT * (landingPct - FOUL_LINE_PCT);
      javelinBottomPct = GROUND_PCT + peakHeightPct * 4 * flightT * (1 - flightT);
      const dXdt = landingPct - FOUL_LINE_PCT;
      const dYdt = peakHeightPct * 4 * (1 - 2 * flightT);
      javelinRotationDeg = -Math.atan2(dYdt, dXdt || 1) * (180 / Math.PI);
      if (flightT >= 1) {
        landedLabel = { xPct: landingPct, text: `${throwResult.distance.toFixed(1)}m`, isFoul: false };
      }
    }
  }

  return (
    <div className="flex flex-col gap-4 items-center w-full">
      {/* Field scene */}
      <div className="relative w-full h-48 sm:h-56 rounded-xl overflow-hidden border border-white/10">
        <div className="absolute inset-0 bg-gradient-to-b from-sky-700 via-sky-600 to-sky-500" />
        <div className="absolute bottom-0 left-0 right-0 h-[28%] bg-gradient-to-b from-emerald-700 to-emerald-800" />

        {/* Foul line */}
        <div className="absolute bottom-0 w-0.5 h-[30%] bg-rose-400/70" style={{ left: `${FOUL_LINE_PCT}%` }} />

        {/* Distance markers */}
        {[10, 20, 30, 40].map((m) => (
          <div
            key={m}
            className="absolute bottom-[14%] text-[10px] text-white/40"
            style={{ left: `${landingXPct(m)}%`, transform: "translateX(-50%)" }}
          >
            {m}m
          </div>
        ))}

        {/* Runner */}
        {!activeFlight && game.status === "playing" && (
          <div
            className="absolute text-3xl transition-none"
            style={{ left: `${runnerPct}%`, bottom: `${GROUND_PCT}%`, transform: "translate(-50%, 30%)" }}
          >
            {runnerEmoji}
          </div>
        )}

        {/* Javelin in flight */}
        {javelinVisible && (
          <div
            className="absolute w-9 h-1 bg-amber-300 rounded-full"
            style={{
              left: `${javelinXPct}%`,
              bottom: `${javelinBottomPct}%`,
              transform: `translate(-50%, 50%) rotate(${javelinRotationDeg}deg)`,
            }}
          />
        )}

        {/* Foul banner */}
        {showFoulBanner && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-black text-rose-300 drop-shadow">FOUL!</span>
          </div>
        )}

        {/* Landed marker */}
        {landedLabel && (
          <div
            className="absolute bottom-[14%] flex flex-col items-center gap-0.5"
            style={{ left: `${landedLabel.xPct}%`, transform: "translateX(-50%)" }}
          >
            <div className={`w-0.5 h-6 ${landedLabel.isFoul ? "bg-rose-400" : "bg-amber-300"}`} />
            <span className={`text-xs font-bold ${landedLabel.isFoul ? "text-rose-300" : "text-amber-200"}`}>
              {landedLabel.text}
            </span>
          </div>
        )}
      </div>

      {/* Interactive controls */}
      {game.status === "playing" && (
        <>
          {showControls ? (
            <div className="flex flex-col gap-3 items-center w-full">
              <p className="text-sm text-slate-300">
                Throw {yourThrowCount + 1} of {MAX_THROWS} —{" "}
                {phase === "angle" && "lock your angle"}
                {phase === "power" && "lock your power"}
                {phase === "runup" && "click Throw! before you cross the line"}
              </p>

              {phase === "angle" && (
                <div className="flex flex-col items-center gap-3">
                  <AngleGauge angle={currentAngle()} />
                  <button
                    onClick={handleAngleLock}
                    className="bg-indigo-500 hover:bg-indigo-400 transition rounded-lg px-8 py-3 font-medium"
                  >
                    Lock Angle
                  </button>
                </div>
              )}

              {phase === "power" && (
                <div className="flex items-center gap-4">
                  <PowerGauge power={currentPower()} />
                  <button
                    onClick={handlePowerLock}
                    className="bg-indigo-500 hover:bg-indigo-400 transition rounded-lg px-8 py-3 font-medium"
                  >
                    Lock Power
                  </button>
                </div>
              )}

              {phase === "runup" && (
                <button
                  onClick={handleThrowClick}
                  className="bg-rose-500 hover:bg-rose-400 transition rounded-lg px-10 py-4 text-lg font-bold"
                >
                  Throw!
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-300">
              {activeFlight ? (activeFlight.slot === yourSlot ? "Your javelin is in the air…" : "Your partner's javelin is in the air…") : "Your partner is throwing…"}
            </p>
          )}
        </>
      )}

      {/* Scoreboard */}
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

/** Quarter-circle protractor: 0deg pointing right, 90deg pointing straight up. */
function AngleGauge({ angle }: { angle: number }) {
  const rad = (angle * Math.PI) / 180;
  const needleX = 10 + 80 * Math.cos(rad);
  const needleY = 90 - 80 * Math.sin(rad);
  const sweetStartRad = ((SWEET_SPOT - SWEET_SPOT_BAND) * Math.PI) / 180;
  const sweetEndRad = ((SWEET_SPOT + SWEET_SPOT_BAND) * Math.PI) / 180;
  const arcPoint = (r: number) => `${10 + 80 * Math.cos(r)},${90 - 80 * Math.sin(r)}`;

  return (
    <svg width="120" height="100" viewBox="0 0 120 100" className="overflow-visible">
      {/* base arc */}
      <path d="M 90 90 A 80 80 0 0 0 10 90" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="6" strokeLinecap="round" />
      {/* sweet spot band */}
      <path
        d={`M ${arcPoint(sweetStartRad)} A 80 80 0 0 0 ${arcPoint(sweetEndRad)}`}
        fill="none"
        stroke="#4ade80"
        strokeOpacity="0.6"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {/* pivot */}
      <circle cx="10" cy="90" r="4" fill="#818cf8" />
      {/* needle */}
      <line x1="10" y1="90" x2={needleX} y2={needleY} stroke="#818cf8" strokeWidth="3" strokeLinecap="round" />
      <text x="60" y="20" textAnchor="middle" fontSize="12" fill="#cbd5e1">
        {Math.round(angle)}°
      </text>
    </svg>
  );
}

function PowerGauge({ power }: { power: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-8 h-32 bg-white/5 rounded-full border border-white/15 overflow-hidden flex flex-col justify-end">
        <div className="w-full bg-gradient-to-t from-indigo-500 to-indigo-300 transition-none" style={{ height: `${power}%` }} />
        {[25, 50, 75].map((mark) => (
          <div key={mark} className="absolute left-0 right-0 h-px bg-white/20" style={{ bottom: `${mark}%` }} />
        ))}
      </div>
      <span className="text-xs text-slate-300">{Math.round(power)}%</span>
    </div>
  );
}
