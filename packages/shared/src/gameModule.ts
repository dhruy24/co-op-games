export type PlayerSlot = 1 | 2;

/**
 * A GameModule defines the pure rules for one co-op game: how to create
 * initial state, how a player's action transforms that state, and when the
 * game is over. Games have no hidden per-player info, so the same state is
 * broadcast to both players. Implementations must be pure functions so
 * they're easy to unit test independent of any networking code.
 */
export interface GameModule<State, Action, ClientState = State> {
  id: string;
  createInitialState(): State;
  /** Returns the next state. Should not mutate `state`. */
  applyAction(state: State, playerSlot: PlayerSlot, action: Action): State;
  isGameOver(state: State): boolean;
  /**
   * Maps internal state to what's safe to broadcast to clients (e.g. hiding
   * an answer until the game ends). Defaults to identity if omitted — only
   * override this for games that have something to hide mid-game.
   */
  toClientState?(state: State): ClientState;
}

const registry = new Map<string, GameModule<unknown, unknown, unknown>>();

export function registerGame<State, Action, ClientState = State>(
  game: GameModule<State, Action, ClientState>
): void {
  registry.set(game.id, game as GameModule<unknown, unknown, unknown>);
}

export function getGame(id: string): GameModule<unknown, unknown, unknown> | undefined {
  return registry.get(id);
}

export function listGameIds(): string[] {
  return [...registry.keys()];
}

/** Runs a game module's toClientState if it defines one, else passes state through unchanged. */
export function getClientState(game: GameModule<unknown, unknown, unknown>, state: unknown): unknown {
  return game.toClientState ? game.toClientState(state) : state;
}
