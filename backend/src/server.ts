import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyRateLimit from "@fastify/rate-limit";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { youtubeRouter } from "./youtubeRouter.js";
import { createContext } from "./trpc.js";
import { db } from "./db/index.js";
import { refreshTokens } from "./db/drizzle/schema/schema.js";
import { lt } from "drizzle-orm";
import { config } from "./config.js";

const fastify = Fastify({
    logger: true
})

const refreshTokenCleanupInterval = setInterval(async () => {
    await db.delete(refreshTokens).where(lt(refreshTokens.expiresAt, new Date()));
}, 60 * 60 * 1000);
refreshTokenCleanupInterval.unref();

fastify.addHook('onClose', async () => {
    clearInterval(refreshTokenCleanupInterval);
});

const startServer = async () => {
    try {
        await fastify.register(fastifyCors, {
            origin: config.ALLOWED_ORIGIN,
            methods: ["GET", "POST", "OPTIONS"],
            allowedHeaders: ["Content-Type", "Authorization"]
        });

        await fastify.register(fastifyRateLimit, {
            global: true,
            max: 100,
            timeWindow: '1 minute'
        });

        const authRateLimit = fastify.createRateLimit({
            max: 5,
            timeWindow: '1 minute',
            keyGenerator: (request) => request.ip
        });

        fastify.addHook('preHandler', async (request, reply) => {
            if (/\/trpc\/(login|signUp)(?:[/?]|$)/.test(request.url)) {
                const result = await authRateLimit(request);
                if (!result.isAllowed) {
                    await reply.code(429).send({
                        error: 'Too Many Requests'
                    });
                }
            }
        });

        await fastify.register(fastifyTRPCPlugin, {
            prefix: '/trpc',
            trpcOptions: { router: youtubeRouter, createContext }
        });

        await fastify.listen({ port: 3000, host: '0.0.0.0' });
        console.log('Server is running on http://localhost:3000');
    }
    catch (err) {
        fastify.log.error(err);
        process.exit(1);
    };
}

startServer();