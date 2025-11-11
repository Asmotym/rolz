import { neon } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL ?? process.env.NETLIFY_DATABASE_URL;

if (!connectionString) {
    throw new Error('DATABASE_URL is not configured.');
}

export const sql = neon(connectionString);

export async function query<T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> {
    return sql(strings, ...values) as Promise<T[]>;
}
