import { SignJWT, jwtVerify } from "jose";
import { type FastifyReply } from "fastify";
import { refreshTokens } from "../db/drizzle/schema/schema.js";
import { db } from "../db/index.js"

const ACCESS_KEY = new TextEncoder().encode(process.env.JWT_SECRET!);
const REFRESH_KEY = new TextEncoder().encode(process.env.JWT_SECRET!);

export interface AccessPayload {
  userId: string;
}

export interface RefreshPayload {
  userId: string;
  tokenId: string; // Maps to a record in your DB for revocation/rotation
}

export const createAccessToken = async (userId: string): Promise<string> => {
    return await new SignJWT({ userId })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('15m')
        .sign(ACCESS_KEY)
}

export const createRefreshToken = async (userId: string, tokenId: string): Promise<string | null> => {
    return await new SignJWT({ userId, tokenId })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('7d')
        .sign(REFRESH_KEY)
}

export const verifyAccessToken = async (token?: string): Promise<AccessPayload | null> => {
    if(!token) return null;
    try {
        const { payload } = await jwtVerify(token, ACCESS_KEY);

        return payload.userId as AccessPayload
    } catch (err) {

        return null
    }
}

export const verifyRefreshToken = async (token?: string): Promise<RefreshPayload | null> => {
    if(!token) return null;
    try {
        const { payload } = await jwtVerify(token, REFRESH_KEY);

        return payload.userId as unknown as RefreshPayload
    } catch (err) {

        return null
    }
}

export function setAuthCookies(res: FastifyReply, access: string, refresh: string) {

    res.setCookie('access_token', access, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 15, // 15 minutes
    });

    res.setCookie('refresh_token', refresh, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
    });
}

export async function createSessionAndSetCookies(
    res: FastifyReply,
    userId: string // Change to `string` if your users.id is a uuid
) {
    // 1. Save a new refresh token session in PostgreSQL
    const [session] = await db
        .insert(refreshTokens)
        .values({
            userId: userId,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        } as any)
        .returning({ id: refreshTokens.id });

    // 2. Sign both JWTs
    const accessToken = await createAccessToken(String(userId));
    const refreshToken = await createRefreshToken(String(userId), session!.id);

    // 3. Attach both HTTP-only cookies to the response
    setAuthCookies(res, accessToken, refreshToken!);
}

export function clearAuthCookies(res: FastifyReply) {
  res.clearCookie('access_token', { path: '/' });
  res.clearCookie('refresh_token', { path: '/' });
}