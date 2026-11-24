import { SignJWT, jwtVerify } from "jose";
import { refreshTokens } from "../db/drizzle/schema/schema.js";
import { db } from "../db/index.js";
import * as crypto from "crypto";
import { config } from "../config.js";

const ACCESS_KEY = new TextEncoder().encode(config.JWT_ACCESS_SECRET);
const REFRESH_KEY = new TextEncoder().encode(config.JWT_REFRESH_SECRET);

export interface RefreshPayload {
    userId: string;
    tokenId: string; // Maps to a record in your DB for revocation/rotation
}

export const hashRefreshToken = (token: string): string =>
    crypto.createHash("sha256").update(token).digest("hex");

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

export const verifyAccessToken = async (token?: string): Promise<string | null> => {
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, ACCESS_KEY, { algorithms: ['HS256'] });

        return payload.userId as string
    } catch (err) {

        return null
    }
}

export const verifyRefreshToken = async (token?: string): Promise<RefreshPayload | null> => {
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, REFRESH_KEY, { algorithms: ['HS256'] });

        return { userId: payload.userId as string, tokenId: payload.tokenId as string }
    } catch (err) {

        return null
    }
}

export async function createSession(
    userId: string // Change to `string` if your users.id is a uuid
) {
    const tokenId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const accessToken = await createAccessToken(String(userId));
    const refreshToken = await createRefreshToken(String(userId), tokenId);

    if (!refreshToken) {
        throw new Error("Failed to create refresh token");
    }

    const [session] = await db
        .insert(refreshTokens)
        .values({
            id: tokenId,
            userId: userId,
            tokenHash: hashRefreshToken(refreshToken),
            expiresAt,
        })
        .returning({ id: refreshTokens.id });

    return { accessToken, refreshToken, sessionId: session!.id };
}