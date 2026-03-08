import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS weightage integer DEFAULT 1;`);
        await client.query(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium';`);
        console.log("Successfully added weightage and priority to assignments.");
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
