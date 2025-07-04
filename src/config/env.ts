import dotenv from 'dotenv';
dotenv.config();

const requiredEnvVars = [
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'POSTGRES_DB',
    'POSTGRES_INITDB_ARG',
    'PGDATA',
    'DATABASE_URL',
    'CACHE_USER_TIME',
    'NATS_URL',
    'PORT',
    'HOST',
    'TEST_API_KEY'
];

for (const name of requiredEnvVars) {
    if (!process.env[name]) {
        throw new Error(`Missing required env variable: ${name}`);
    }
}

export const env = {
    POSTGRES_USER: process.env.POSTGRES_USER as string,
    POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD as string,
    POSTGRES_DB: process.env.POSTGRES_DB as string,
    DATABASE_URL: process.env.DATABASE_URL as string,
    CACHE_USER_TIME: parseInt(process.env.CACHE_USER_TIME as string, 10),
    NATS_URL: process.env.NATS_URL as string,
    PORT: parseInt(process.env.PORT as string, 10) || 3000,
    HOST: process.env.HOST as string,
    TEST_API_KEY: process.env.TEST_API_KEY as string,
}