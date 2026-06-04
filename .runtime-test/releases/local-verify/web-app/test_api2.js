const fs = require('fs');
const path = require('path');

const csvPath = path.join(process.cwd(), 'data', 'exam_seats_kmutnb.csv');
console.log("Reading CSV from:", csvPath);

try {
    const data = fs.readFileSync(csvPath, 'utf8');
    console.log("CSV length:", data.length);
} catch (e) {
    console.error("Failed:", e.message);
}
