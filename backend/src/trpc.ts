import { initTRPC, TRPCError } from "@trpc/server";
import "@fastify/cookie"
import { type CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import { verifyAccessToken, type AccessPayload } from "./auth/auth.js";
import { db } from "./db/index.js";


export const createContext = async ({ req, res }: CreateFastifyContextOptions) => {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : req.cookies.auth_token;

    let userId: AccessPayload | null | string = await verifyAccessToken(token);

    return {
        req,
        res,
        db,
        userId
    }
};

// Initialize tRPC server
const t = initTRPC.context<typeof createContext>().create();

const isAuthed = t.middleware(({ ctx, next }) => {
    if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

    return next({
        ctx: {
            userId: ctx.userId
        }
    })
})

// Export resuable router and procedure helpers
export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthed);
