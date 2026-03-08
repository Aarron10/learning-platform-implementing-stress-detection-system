// test_upload.js
import fs from 'fs';
import path from 'path';

async function testUpload() {
    // Create a dummy file
    fs.writeFileSync('dummy.pdf', 'hello world pdf data');

    // We need to use FormData for a node-fetch equivalent. Native fetch in Node does not have FormData easily built-in for multipart until v20+ but let's just make a raw multipart request
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    let body = '';
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="title"\r\n\r\n`;
    body += `Test Assignment\r\n`;
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="description"\r\n\r\n`;
    body += `Test Description\r\n`;
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="dueDate"\r\n\r\n`;
    body += new Date().toISOString() + `\r\n`;
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="status"\r\n\r\n`;
    body += `active\r\n`;
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="file"; filename="dummy.pdf"\r\n`;
    body += `Content-Type: application/pdf\r\n\r\n`;
    body += fs.readFileSync('dummy.pdf').toString('binary') + `\r\n`;
    body += `--${boundary}--\r\n`;

    try {
        const res = await fetch("http://localhost:5000/api/assignments", {
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                // Note: we might get Unauthenticated if there lacks a session.
            },
            body: Buffer.from(body, 'binary')
        });

        console.log("Status:", res.status);
        const json = await res.json().catch(() => null);
        console.log("Response:", json);
    } catch (err) {
        console.error(err);
    }
}

testUpload();
