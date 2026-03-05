import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT state_classification, count(*) FROM session_telemetry WHERE session_id = 17 GROUP BY state_classification`);
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}
check();
