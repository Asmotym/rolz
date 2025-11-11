import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL ?? process.env.NETLIFY_DATABASE_URL;

if (!connectionString) {
    throw new Error('DATABASE_URL is not configured.');
}

const sslRequired = process.env.DATABASE_SSL === 'true' || /sslmode=require/.test(connectionString);

const sql = postgres(connectionString, {
    ssl: sslRequired ? 'require' : undefined,
    max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
    idle_timeout: Number(process.env.DATABASE_IDLE_TIMEOUT ?? 20),
    connect_timeout: Number(process.env.DATABASE_CONNECT_TIMEOUT ?? 30)
});

export { sql };
