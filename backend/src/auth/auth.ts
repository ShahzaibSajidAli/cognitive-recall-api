import { SignJWT, jwtVerify } from "jose";
import { refreshTokens } from "../db/drizzle/schema/schema.js";
import { db } from "../db/index.js";
import * as crypto from "crypto";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

const candidatePaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../../.env'),
]

const localEnvPath = candidatePaths.find(p => fs.existsSync(p)) || candidatePaths[0];

if (localEnvPath) {
    dotenv.config({ path: localEnvPath });
}
else {
    console.log("Production Environment Detected!. Using cloud injected variables.")
}

const ACCESS_KEY = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);
const REFRESH_KEY = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET!);

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
    // 1. Save a new refresh token session in PostgreSQL
    const tokenId = crypto.randomUUID();
    const [session] = await db
        .insert(refreshTokens)
        .values({
            id: tokenId,
            userId: userId,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        })
        .returning({ id: refreshTokens.id });

    // 2. Sign both JWTs
    const accessToken = await createAccessToken(String(userId));
    const refreshToken = await createRefreshToken(String(userId), session!.id);

    return { accessToken, refreshToken };
}