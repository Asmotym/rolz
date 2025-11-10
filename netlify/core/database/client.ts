import { neon } from '@netlify/neon';

const connectionString = process.env.NETLIFY_DATABASE_URL;

if (!connectionString) {
    throw new Error('NETLIFY_DATABASE_URL is not configured.');
}

export const sql = neon(connectionString);

export async function query<T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> {
    return sql<T>(strings, values as never);
}
