import { Pool } from 'pg'
import {logger} from "./logger";
import {runMigrations} from "./scripts/migrate";
import {env} from "./config/env";

export const db = new Pool({
    host: env.POSTGRES_DB,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    database: env.POSTGRES_DB,
    port: 5432,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    maxLifetimeSeconds: 60
})

export async function initDb() {
    try {
        await db.connect();
        runMigrations();
        logger.info('[DB] Connection established');
    } catch (error) {
        logger.error(`[DB] Connection failed: ${error}`);
        throw error;
    }
}

export const closeDb = async () => {
    await db.end();
    console.log('Database connection closed');
};
