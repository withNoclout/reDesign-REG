const zlib = require('zlib');

const base64Data = "H4sIAAAAAAAACouOBQApu0wNAgAAAA==";
const buffer = Buffer.from(base64Data, 'base64');

zlib.gunzip(buffer, (err, result) => {
    if (err) {
        console.error("Error unzipping:", err);
    } else {
        console.log("Decoded Data:", result.toString());
    }
});
