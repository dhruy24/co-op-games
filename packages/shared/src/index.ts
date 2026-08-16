import { registerGame } from "./gameModule.js";
import { wordDuelGame } from "./games/wordDuel.js";
import { memoryMatchGame } from "./games/memoryMatch.js";
import { javelinDuelGame } from "./games/javelinDuel.js";

// Populates the game registry as a side effect of importing this package —
// both the server and the client always import from this barrel, so both
// end up with the same set of playable games registered.
registerGame(wordDuelGame);
registerGame(memoryMatchGame);
registerGame(javelinDuelGame);

export * from "./roomCode.js";
export * from "./gameModule.js";
export * from "./roomEvents.js";
export * from "./games/wordDuel.js";
export * from "./games/wordList.js";
export * from "./games/memoryMatch.js";
export * from "./games/javelinDuel.js";
