import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { config } from "../config.js";

const pool = new Pool({
    connectionString: config.DATABASE_URL,
    max: 10,
    ssl: {
        rejectUnauthorized: false
    }
})

const db = drizzle({ client: pool });

export { db };

