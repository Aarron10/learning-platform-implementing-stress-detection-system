import "dotenv/config";
import { pool } from "./server/db";

async function run() {
    try {
        console.log("Connecting to the database...");

        // Add attachment_url to assignments
        await pool.query(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS attachment_url text;`);
        console.log("Successfully added attachment_url to assignments.");

        // Also ensuring study_sessions exist just in case Drizzle skipped it entirely
        await pool.query(`
      CREATE TABLE IF NOT EXISTS study_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        assignment_id INTEGER,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        duration_minutes INTEGER NOT NULL,
        avg_focus_score INTEGER,
        avg_stress_score INTEGER,
        avg_distraction_score INTEGER
      );
    `);

        await pool.query(`
      CREATE TABLE IF NOT EXISTS session_telemetry (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL,
        timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
        focus_score INTEGER,
        stress_score INTEGER,
        distraction_score INTEGER
      );
    `);

        console.log("Successfully verified study_sessions and session_telemetry exist.");

    } catch (err) {
        console.error("Failed to run schema update:", err);
    } finally {
        process.exit(0);
    }
}

run();
