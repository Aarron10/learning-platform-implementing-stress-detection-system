import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function inject() {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT id FROM session_telemetry WHERE session_id = 17 ORDER BY id');
        const ids = res.rows.map(r => r.id);

        console.log("Total rows found:", ids.length);

        if (ids.length >= 15) {
            // Change rows 5 to 9 to Stressed
            for (let i = 5; i < 10; i++) {
                await client.query(
                    `UPDATE session_telemetry SET state_classification='Stressed', stress_score=$1, focus_score=$2 WHERE id=$3`,
                    [85, 10, ids[i]]
                );
            }

            // Change rows 10 to 14 to Distracted
            for (let i = 10; i < 15; i++) {
                await client.query(
                    `UPDATE session_telemetry SET state_classification='Distracted (Browser)', stress_score=$1, focus_score=$2, distracted_score=$3 WHERE id=$4`,
                    [20, 10, 80, ids[i]]
                );
            }
            console.log("Injection SUCCESS!");
        } else {
            console.log("Not enough rows.");
        }
    } catch (e) {
        console.error("Injection error:", e);
    } finally {
        client.release();
        await pool.end();
    }
}
inject();
