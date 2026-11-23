import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { config } from "../config.js";

if (process.env.NODE_ENV === 'production' && !config.DATABASE_CA_CERT) {
    throw new Error('DATABASE_CA_CERT is required when NODE_ENV is production');
}

const pool = new Pool({
    connectionString: config.DATABASE_URL,
    max: 10,
    ...(config.DATABASE_CA_CERT
        ? {
            ssl: {
                ca: config.DATABASE_CA_CERT,
                rejectUnauthorized: true
            }
        }
        : {})
})

const db = drizzle({ client: pool });

export { db };

