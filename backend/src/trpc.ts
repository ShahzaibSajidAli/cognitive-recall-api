import { initTRPC } from "@trpc/server";

// Initialize tRPC server
const t = initTRPC.create();

// Export resuable router and procedure helpers
export const router = t.router;
export const procedure = t.procedure;
