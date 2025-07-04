import { connect, NatsConnection } from 'nats';
import { env } from '../config/env';
import { logger } from '../logger';

let nc: NatsConnection | null = null;

export async function initializeNats(): Promise<void> {
    if (nc && !nc.isClosed()) {
        logger.info('[NATS] Connection already established.');
        return;
    }
    try {
        nc = await connect({ servers: env.NATS_URL });
        logger.info(`[NATS] Connected to server at ${nc.getServer()}`);
    } catch (err) {
        logger.error({ err }, '[NATS] Failed to connect');
        throw err;
    }
}

export function getNatsConnection(): NatsConnection {
    if (!nc || nc.isClosed()) {
        throw new Error('NATS connection is not initialized or has been closed. Call initializeNats() first.');
    }
    return nc;
}

export async function stopNats(): Promise<void> {
    if (nc && !nc.isClosed()) {
        await nc.close();
        logger.info('[NATS] Connection closed.');
    } else {
        logger.info('[NATS] Connection was not active, no need to stop.');
    }
}