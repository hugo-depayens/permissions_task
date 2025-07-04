import Fastify from 'fastify';
import { initDb, closeDb, db } from './db';
import { env } from './config/env';

import { initializeNats, stopNats, getNatsConnection } from './nats/connection';
import { startNatsListeners } from './nats/nats-server';
import { test } from './tests/test';

const fastify = Fastify({
    logger: { level: 'trace' },
})

fastify.get('/health', async (request, reply) => {
    try {
        const natsConnection = getNatsConnection();
        if (natsConnection.isClosed()) {
            throw new Error('NATS connection is reported as closed.');
        }
        const dbClient = await db.connect();
        await dbClient.query('SELECT 1');
        dbClient.release();

        return {
            status: 'ok',
            dependencies: {
                database: 'ok',
                nats: 'ok',
            },
        };
    } catch (error: any) {
        fastify.log.error(error, 'Health check failed');

        reply.status(503).send({
            status: 'unhealthy',
            error: {
                message: error.message,
                dependency: error.message.toLowerCase().includes('nats') ? 'nats' : 'database',
            },
        });
    }
});


async function startServer(): Promise<void> {
    try {
        await initDb();
        await initializeNats();

        const natsConnection = getNatsConnection();
        await startNatsListeners(natsConnection);

        await test();

        await fastify.listen({ port: env.PORT, host: env.HOST || '0.0.0.0' });

    } catch (e) {
        fastify.log.error(e, 'Error during server startup');
        process.exit(1);
    }
}

const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
signals.forEach(signal => {
    process.on(signal, async () => {
        fastify.log.info(`Received ${signal}, shutting down gracefully...`);
        try {
            await fastify.close();
            fastify.log.info('Fastify server closed.');

            await stopNats();
            await closeDb();

            process.exit(0);
        } catch (err) {
            fastify.log.error(err, 'Error during graceful shutdown');
            process.exit(1);
        }
    });
});

startServer();