const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// Test the portfolio upload endpoint
async function testPortfolioUpload() {
    try {
        const imagePath = path.join(__dirname, '../../BG_image/login logo.png');

        if (!fs.existsSync(imagePath)) {
            console.error('Test image not found:', imagePath);
            process.exit(1);
        }

        const form = new FormData();
        form.append('title', 'Test Upload from Script');
        form.append('description', 'This is a test upload using the new direct HTTP approach');
        form.append('image', fs.createReadStream(imagePath));

        console.log('Testing portfolio upload to http://localhost:3000/api/portfolio/content...');

        const response = await fetch('http://localhost:3000/api/portfolio/content', {
            method: 'POST',
            body: form,
            headers: form.getHeaders()
        });

        const result = await response.json();

        console.log('Response Status:', response.status);
        console.log('Response:', JSON.stringify(result, null, 2));

        if (result.success) {
            console.log('\n✅ Upload successful!');
            console.log('Image URL:', result.data[0]?.image_url);
        } else {
            console.log('\n❌ Upload failed:', result.message);
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testPortfolioUpload();