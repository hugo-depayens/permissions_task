import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { Client } from 'pg';
import dotenv from 'dotenv';
import { logger } from '../logger';
import {fileURLToPath} from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, '../migrations');
const DATABASE_URL = process.env.DATABASE_URL;

async function ensureMigrationsTableExists(client: Client): Promise<void> {
    await client.query(`
        CREATE TABLE IF NOT EXISTS migrations (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            applied_at TIMESTAMPTZ DEFAULT now()
        );
    `);
}

async function getAppliedMigrations(client: Client): Promise<Set<string>> {
    const result = await client.query<{ name: string }>('SELECT name FROM migrations;');
    return new Set(result.rows.map(row => row.name));
}

async function applyMigration(client: Client, fileName: string): Promise<void> {
    const filePath = path.join(MIGRATIONS_DIR, fileName);
    const sql = await readFile(filePath, 'utf-8');

    logger.info(`Applying migration: ${fileName}`);

    try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO migrations(name) VALUES ($1)', [fileName]);
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`Failed to apply migration ${fileName}`)
        throw error;
    }
}

export async function runMigrations() {
    if (!DATABASE_URL) {
        logger.error('Missing DATABASE_URL in environment.');
        process.exit(1);
    }

    const client = new Client({ connectionString: DATABASE_URL });

    try {
        await client.connect();
        logger.info('Connected to database.');

        await ensureMigrationsTableExists(client);

        const allMigrationFiles = (await readdir(MIGRATIONS_DIR)).sort();
        const appliedMigrations = await getAppliedMigrations(client);

        const migrationsToApply = allMigrationFiles.filter(
            file => !appliedMigrations.has(file)
        );

        if (migrationsToApply.length === 0) {
            logger.info('No new migrations to apply.');
            return;
        }

        logger.info(`Applying ${migrationsToApply.length} migration(s).`);

        for (const file of migrationsToApply) {
            await applyMigration(client, file);
        }

        logger.info('Migrations completed successfully.');
    } catch (error) {
        logger.error('Migration failed.', { err: error });
        throw error;
    } finally {
        await client.end();
        logger.info('Disconnected from database.');
    }
}

async function main() {
    try {
        await runMigrations();
        process.exit(0);
    } catch {
        process.exit(1);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
