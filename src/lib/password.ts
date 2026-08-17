import bcrypt from "bcryptjs";

// Central password hashing so cost factor + algorithm live in one place.
const ROUNDS = 10;

export const hashPassword = (pw: string): Promise<string> =>
  bcrypt.hash(pw, ROUNDS);

export const verifyPassword = (pw: string, hash: string): Promise<boolean> =>
  bcrypt.compare(pw, hash);
