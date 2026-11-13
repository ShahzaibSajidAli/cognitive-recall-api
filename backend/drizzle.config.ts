import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

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

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/drizzle/schema/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});

