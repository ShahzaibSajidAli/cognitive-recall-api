import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { config } from "../config.js";
import fs from "node:fs";

if (config.NODE_ENV === 'production' && !config.DATABASE_CA_CERT_PATH) {
    throw new Error('DATABASE_CA_CERT_PATH is required when NODE_ENV is production');
}

const ca = config.DATABASE_CA_CERT_PATH
    ? fs.readFileSync(config.DATABASE_CA_CERT_PATH, 'utf8')
    : undefined;

const pool = new Pool({
    connectionString: config.DATABASE_URL,
    max: 10,
    ...(ca
        ? {
            ssl: {
                ca,
                rejectUnauthorized: true
            }
        }
        : {})
})

const db = drizzle({ client: pool });

export { db };

