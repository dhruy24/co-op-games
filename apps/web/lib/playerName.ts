const STORAGE_KEY = "co-op-games:playerName";

/** Reads the saved player name, or null if none is set yet (e.g. first visit). */
export function getSavedPlayerName(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // localStorage unavailable (private browsing, etc.)
  }
}

export function savePlayerName(name: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // Ignore — name just won't persist across visits.
  }
}
