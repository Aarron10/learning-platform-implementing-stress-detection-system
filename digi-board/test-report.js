async function test() {
    try {
        const res = await fetch('http://localhost:8000/api/download_report/17');
        console.log("Status:", res.status);
        if (!res.ok) {
            const text = await res.text();
            console.log("Error body:", text);
        } else {
            console.log("Success! Got bytes:", (await res.arrayBuffer()).byteLength);
        }
    } catch (e) {
        console.error(e);
    }
}
test();
