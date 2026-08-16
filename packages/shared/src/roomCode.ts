// Room codes use a restricted alphabet that avoids visually-ambiguous
// characters (0/O, 1/I/L) so they're easy to read aloud or type on mobile.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;

export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

export function isValidRoomCode(code: string): boolean {
  if (code.length !== CODE_LENGTH) return false;
  return [...code.toUpperCase()].every((c) => ALPHABET.includes(c));
}

export function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase();
}
