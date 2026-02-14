const fs = require('fs');
const c = fs.readFileSync('d:/reDesign-REG/main_bundle.js', 'utf8');

// Angular outputs chunk files named like: 4461.xxxhash.js
// The webpack runtime maps chunk IDs to filenames
// Look for the chunk ID to filename mapping

// Search for the chunkIds mapping or __webpack_require__.u (or similar)
const runtimePatterns = [
    'u=function(e)',  // webpack's __webpack_require__.u = function(e) { return ...  }
    'chunkId',
    '.js"',  // chunk filename patterns
    '8592.',
    '4461.',
];

runtimePatterns.forEach(p => {
    let idx = c.lastIndexOf(p); // search from end where webpack runtime usually lives
    if (idx > -1) {
        console.log(`\n--- "${p}" at ${idx} (near end) ---`);
        console.log(c.substring(Math.max(0, idx - 100), idx + 300));
        console.log('---');
    }
});

// Better approach: search for chunk mapping pattern: {4461:"hash",8592:"hash"}
// Or: e + "." + {4461:"xxxx"}[e] + ".js"
const mapIdx = c.indexOf('"4461"');
const mapIdx2 = c.indexOf("'4461'");
const mapIdx3 = c.indexOf('4461:');
console.log('\n\n=== Direct search for 4461 ===');
console.log('"4461":', mapIdx > -1 ? mapIdx : 'NOT FOUND');
console.log("'4461':", mapIdx2 > -1 ? mapIdx2 : 'NOT FOUND');
console.log('4461:', mapIdx3 > -1 ? mapIdx3 : 'NOT FOUND');

if (mapIdx3 > -1) {
    console.log('\nContext:', c.substring(Math.max(0, mapIdx3 - 300), mapIdx3 + 500));
}
