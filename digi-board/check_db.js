import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
});

async function check() {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT state_classification, count(*) FROM session_telemetry WHERE session_id = 17 GROUP BY state_classification`);
        console.log("Classifications for Session 17:");
        console.table(res.rows);

        const res2 = await client.query(`SELECT focus_score, stress_score, state_classification FROM session_telemetry WHERE session_id = 17 AND focus_score < 50 LIMIT 10`);
        console.log("Samples with low focus:");
        console.table(res2.rows);
    } catch (err) {
        console.error("Failed:", err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

check();
