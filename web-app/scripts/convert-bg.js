
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputInfo = [
    { src: 'public/BG_image/loginpage.png', dest: 'public/BG_image/loginpage.webp' }
];

async function convert() {
    for (const item of inputInfo) {
        const inputPath = path.resolve(process.cwd(), item.src);
        const outputPath = path.resolve(process.cwd(), item.dest);

        if (!fs.existsSync(inputPath)) {
            console.error(`Input file not found: ${inputPath}`);
            continue;
        }

        try {
            await sharp(inputPath)
                .webp({ quality: 80 })
                .toFile(outputPath);
            console.log(`Converted: ${item.src} -> ${item.dest}`);

            // Get sizes
            const inputStats = fs.statSync(inputPath);
            const outputStats = fs.statSync(outputPath);
            console.log(`Size: ${(inputStats.size / 1024).toFixed(2)}KB -> ${(outputStats.size / 1024).toFixed(2)}KB`);

        } catch (err) {
            console.error(`Error converting ${item.src}:`, err);
        }
    }
}

convert();
