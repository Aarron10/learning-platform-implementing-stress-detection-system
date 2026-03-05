async function test() {
    try {
        const res = await fetch('http://localhost:8000/api/download_report/18');
        console.log("Status:", res.status);
        if (!res.ok) {
            console.log("Error body:", await res.text());
        } else {
            console.log("Success! Got bytes:", (await res.arrayBuffer()).byteLength);
        }
    } catch (e) {
        console.error(e);
    }
}
test();
