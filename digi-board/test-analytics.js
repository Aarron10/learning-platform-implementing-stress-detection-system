async function test() {
    try {
        const res = await fetch('http://localhost:8000/api/session_analytics/17');
        console.log("Status:", res.status);
        if (!res.ok) {
            console.log("Error body:", await res.text());
        } else {
            console.log("Success! Got data:", Object.keys(await res.json()));
        }
    } catch (e) {
        console.error(e);
    }
}
test();
