import http from "http";

const checkFile = () => {
    http.get('http://localhost:5000/fileuploads/0041d0f8-6910-4b26-9bbd-97a4fcd048bc.png', (res) => {
        console.log("Status Code:", res.statusCode);
        console.log("Content-Type:", res.headers['content-type']);
    }).on('error', (e) => {
        console.error("Error:", e);
    });
};

checkFile();
