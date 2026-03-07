const cheerio = require('cheerio');

async function testFetchAndScrape(studentId, courseCode) {
    try {
        const formData = new URLSearchParams();
        formData.append('student_id', studentId);

        const res = await fetch('https://www.eng.kmutnb.ac.th/eservice/exam/seating', {
            method: 'POST',
            body: formData,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const html = await res.text();
        const $ = cheerio.load(html);

        let maxCol = 0;
        let maxRow = 0;
        let found = false;

        $('.media-body').each((i, el) => {
            const courseText = $(el).find('strong.text-gray-dark').first().text().trim();
            if (courseText.includes(courseCode)) {
                found = true;
                console.log("Found course:", courseText);

                $(el).find('.seatmap-colnum').each((j, colEl) => {
                    const val = parseInt($(colEl).text().trim(), 10);
                    if (!isNaN(val) && val > maxCol) maxCol = val;
                });

                $(el).find('.seatmap-rownum').each((j, rowEl) => {
                    const char = $(rowEl).text().trim();
                    if (char && char.length === 1) {
                        const val = char.charCodeAt(0) - 64; // A=1
                        if (val > maxRow) maxRow = val;
                    }
                });
            }
        });

        console.log(`Course: ${courseCode} => Found: ${found}, MaxRow: ${maxRow}, MaxCol: ${maxCol}`);

    } catch (e) {
        console.error(e);
    }
}

testFetchAndScrape('6301001621189', '010013306');
testFetchAndScrape('6301001621189', '010013014');
testFetchAndScrape('6301001621189', '010013102');
