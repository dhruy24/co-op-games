export type PlayerSlot = 1 | 2;

/**
 * A GameModule defines the pure rules for one co-op game: how to create
 * initial state, how a player's action transforms that state, and when the
 * game is over. Games have no hidden per-player info, so the same state is
 * broadcast to both players. Implementations must be pure functions so
 * they're easy to unit test independent of any networking code.
 */
export interface GameModule<State, Action> {
  id: string;
  createInitialState(): State;
  /** Returns the next state. Should not mutate `state`. */
  applyAction(state: State, playerSlot: PlayerSlot, action: Action): State;
  isGameOver(state: State): boolean;
}

const registry = new Map<string, GameModule<unknown, unknown>>();

export function registerGame<State, Action>(game: GameModule<State, Action>): void {
  registry.set(game.id, game as GameModule<unknown, unknown>);
}

export function getGame(id: string): GameModule<unknown, unknown> | undefined {
  return registry.get(id);
}
