const fs = require('fs');
const path = require('path');

const dirsToScan = ['.', './scripts'];
const fileExtensions = ['.js', '.cjs'];

function refactorFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Check if it already has dotenv
    const hasDotenv = content.includes("require('dotenv')");

    // Replace s6701091611290 with process.env.REG_USERNAME fallback
    if (content.match(/['"`]s6701091611290['"`]/)) {
        content = content.replace(/['"`]s6701091611290['"`]/g, "process.env.REG_USERNAME || 's6701091611290'");
        modified = true;
    }

    // Replace hardcoded passwords (035037603za) with process.env.REG_PASSWORD fallback
    if (content.match(/['"`]035037603za['"`]/)) {
        content = content.replace(/['"`]035037603za['"`]/g, "process.env.REG_PASSWORD || '035037603za'");
        modified = true;
    }

    if (modified && !hasDotenv) {
        // Prepend dotenv to the top of the file
        content = `require('dotenv').config({ path: path.resolve(__dirname, ${filePath.startsWith('scripts') ? "'../.env.local'" : "'.env.local'"}) });\n` + content;
        // ensure path is required
        if (!content.includes("require('path')")) {
            content = "const path = require('path');\n" + content;
        }

    }

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated: ${filePath}`);
    }
}

dirsToScan.forEach(dir => {
    const fullPath = path.join(__dirname, dir);
    if (fs.existsSync(fullPath)) {
        const files = fs.readdirSync(fullPath);
        files.forEach(file => {
            if (fileExtensions.some(ext => file.endsWith(ext))) {
                const targetFilePath = path.join(dir, file);
                // Skip this script itself and node_modules
                if (file !== 'refactor_env.js' && !targetFilePath.includes('node_modules')) {
                    refactorFile(targetFilePath);
                }
            }
        });
    }
});

console.log('Refactoring complete.');
