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
        const res1 = await client.query(`SELECT id, started_at FROM study_sessions ORDER BY id DESC LIMIT 2`);
        console.log("Recent sessions:", res1.rows);

        for (const row of res1.rows) {
            const res2 = await client.query(`SELECT COUNT(*) FROM session_telemetry WHERE session_id = $1`, [row.id]);
            console.log(`Session ${row.id} telemetry count:`, res2.rows[0].count);

            if (res2.rows[0].count > 0) {
                const sample = await client.query(`SELECT * FROM session_telemetry WHERE session_id = $1 LIMIT 1`, [row.id]);
                console.log(`Sample telemetry for session ${row.id}:`, sample.rows[0]);
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

check();
