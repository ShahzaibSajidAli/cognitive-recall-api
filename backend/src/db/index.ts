import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const candidatePaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../.env'),
]

const localEnvPath = candidatePaths.find(p => fs.existsSync(p)) || candidatePaths[0];

if (localEnvPath) {
    dotenv.config({ path: localEnvPath });
}
else {
    console.log("Production Environment Detected!. Using cloud injected variables.")
}
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    ssl: {
        rejectUnauthorized: false
    }
})

const db = drizzle({ client: pool });

export { db };

