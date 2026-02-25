import { storage } from "./server/storage";
import { db } from "./server/db";

async function test() {
    try {
        const sessionData = {
            userId: 1, // student user id
            assignmentId: null,
            startedAt: new Date(),
        };
        console.log("Creating study session...");
        const result = await storage.createStudySession(sessionData);
        console.log("Success:", result);
    } catch (err) {
        console.error("Error creating study session:", err);
    }
    process.exit(0);
}

test();
