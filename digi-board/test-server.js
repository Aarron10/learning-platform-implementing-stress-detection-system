async function test() {
    try {
        const res = await fetch('http://localhost:5000/api/assignments');
        console.log("Status:", res.status);
        console.log("Response:", await res.text());
    } catch (e) {
        console.error("Server down:", e.message);
    }
}
test();
