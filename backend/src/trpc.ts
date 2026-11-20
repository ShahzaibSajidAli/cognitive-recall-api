import { initTRPC, TRPCError } from "@trpc/server";
import "@fastify/cookie"
import { type CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import { createAccessToken, verifyAccessToken, verifyRefreshToken, type AccessPayload } from "./auth/auth.js";
import { refreshTokens } from "./db/drizzle/schema/schema.js";
import { eq } from "drizzle-orm";
import { db } from "./db/index.js";


const createContext = async ({ req, res }: CreateFastifyContextOptions) => {

    let userId: AccessPayload | null | string = await verifyAccessToken(req.cookies.access_token);

    if (!userId && req.cookies.refresh_token) {
        const refreshPayload = await verifyRefreshToken(req.cookies.refresh_token);

        if (refreshPayload) {
            const [storedToken] = await db.select().from(refreshTokens).where(eq(refreshTokens.id, refreshPayload.tokenId)) as any;

            if (storedToken) {
                // Check if expired
                if (storedToken.expiresAt <= new Date()) {
                    // 1. Delete the expired row from PostgreSQL
                    await db.delete(refreshTokens).where(eq(refreshTokens.id, storedToken.id));

                    // 2. Clear the dead cookies from the browser
                    res.clearCookie('access_token', { path: '/' });
                    res.clearCookie('refresh_token', { path: '/' });
                } else {
                    // Valid token -> mint a new 15-min access_token!
                    const newAccessToken = await createAccessToken(refreshPayload.userId);
                    res.setCookie('access_token', newAccessToken, {
                        httpOnly: true,
                        secure: true,
                        sameSite: 'lax',
                        path: '/',
                        maxAge: 60 * 15,
                    });

                    userId = refreshPayload.userId;
                }
            }
        }
    }
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
