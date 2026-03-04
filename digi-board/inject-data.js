import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function injectData() {
    const client = await pool.connect();
    try {
        // Get all rows for session 17
        const res = await client.query('SELECT id FROM session_telemetry WHERE session_id = 17 ORDER BY id');
        const ids = res.rows.map(r => r.id);

        // Inject a "Stress" spike in the middle
        if (ids.length >= 20) {
            console.log("Injecting Stressed data...");
            for (let i = 5; i < 11; i++) {
                await client.query(
                    `UPDATE session_telemetry SET state_classification='Stressed', stress_score=$1, focus_score=$2 WHERE id=$3`,
                    [Math.round(75 + Math.random() * 20), Math.round(10 + Math.random() * 15), ids[i]]
                );
            }

            console.log("Injecting Distracted data...");
            for (let i = 15; i < 21; i++) {
                await client.query(
                    `UPDATE session_telemetry SET state_classification='Distracted (Looking Away)', stress_score=$1, focus_score=$2 WHERE id=$3`,
                    [Math.round(20 + Math.random() * 10), Math.round(5 + Math.random() * 15), ids[i]]
                );
            }
            console.log("Successfully injected Stressed and Distracted samples into Session 17!");
        } else {
            console.log("Not enough rows to inject a realistic pattern.");
        }
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

injectData();
