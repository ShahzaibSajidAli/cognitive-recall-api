import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { youtubeRouter } from "./youtubeRouter.js";

const fastify = Fastify({
    logger: true
})

const startServer = async () => {
    try {

        await fastify.register(fastifyCors, {
            origin: "*", // Allow all origins for development; adjust in production
            methods: ["GET", "POST", "OPTIONS"],
            allowedHeaders: ["Content-Type", "Authorization"]
        });

        await fastify.register(fastifyTRPCPlugin, {
            prefix: '/trpc',
            trpcOptions: { router: youtubeRouter }
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