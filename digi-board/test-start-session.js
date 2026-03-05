async function test() {
    try {
        const res = await fetch('http://localhost:5000/api/study-sessions/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assignmentId: null })
        });
        console.log("Start Session Status:", res.status);
        console.log("Body:", await res.text());
    } catch (e) {
        console.error("Server down:", e.message);
    }
}
test();
