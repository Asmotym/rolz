import mysql from 'mysql2/promise';

const connectionString = process.env.DATABASE_URL ?? process.env.NETLIFY_DATABASE_URL;

function buildPoolConfig(): mysql.PoolOptions {
    const shared: mysql.PoolOptions = {
        waitForConnections: true,
        connectionLimit: Number(process.env.DATABASE_POOL_SIZE ?? 10),
        queueLimit: 0,
        connectTimeout: Number(process.env.DATABASE_CONNECT_TIMEOUT ?? 30000),
        timezone: 'Z',
        dateStrings: true,
        supportBigNumbers: true,
        bigNumberStrings: true
    };

    if (connectionString) {
        const url = new URL(connectionString);
        const sslRequired = process.env.DATABASE_SSL === 'true' || url.searchParams.get('sslmode') === 'require';
        const socketPath = url.searchParams.get('socketPath') ?? undefined;

        return {
            ...shared,
            host: socketPath ? undefined : url.hostname,
            port: socketPath ? undefined : Number(url.port || 3306),
            socketPath,
            user: decodeURIComponent(url.username),
            password: decodeURIComponent(url.password),
            database: url.pathname.replace(/^\//, ''),
            ssl: sslRequired ? { rejectUnauthorized: false } : undefined
        };
    }

    const host = process.env.MYSQL_HOST ?? process.env.DATABASE_HOST ?? 'localhost';
    const port = Number(process.env.MYSQL_PORT ?? process.env.DATABASE_PORT ?? 3306);
    const user = process.env.MYSQL_USER ?? process.env.DATABASE_USER;
    const password = process.env.MYSQL_PASSWORD ?? process.env.DATABASE_PASSWORD;
    const database = process.env.MYSQL_DATABASE ?? process.env.DATABASE_NAME;

    if (!user || !database) {
        throw new Error('Missing MySQL configuration. Set DATABASE_URL or MYSQL_* environment variables.');
    }

    const sslRequired = process.env.DATABASE_SSL === 'true';

    return {
        ...shared,
        host,
        port,
        user,
        password,
        database,
        ssl: sslRequired ? { rejectUnauthorized: false } : undefined
    };
}

const pool = mysql.createPool(buildPoolConfig());

export async function query<T = mysql.RowDataPacket[]>(statement: string, params: unknown[] = []): Promise<T> {
    const [rows] = await pool.query(statement, params);
    return rows as T;
}

export async function execute(statement: string, params: unknown[] = []): Promise<mysql.ResultSetHeader> {
    const [result] = await pool.execute(statement, params);
    return result as mysql.ResultSetHeader;
}

export { pool };
