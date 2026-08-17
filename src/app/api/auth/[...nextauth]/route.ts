import { handlers } from "@/auth";

// Auth.js catch-all route (sign-in, callback, session, csrf, signout).
export const { GET, POST } = handlers;
