const axios = require('axios');
const assert = require('assert');

// The base URL of the local dev server
const BASE_URL = 'http://localhost:3000';

// Mock cookies for different users (to test auth/profile extraction)
// 6301011610279: Has exam 40433001
const MOCK_COOKIE_1 = 'mock_std_code=6301011610279';
// 6301002620259: Has exam 80203914
const MOCK_COOKIE_2 = 'mock_std_code=6301002620259';

async function runTests() {
    console.log("Starting API Integration Tests for Exam Seat...\n");

    let passed = 0;
    let failed = 0;

    async function executeTest(testName, url, headers, expectedStatus, skipDataCheck = null) {
        process.stdout.write(`Testing: ${testName}... `);
        try {
            const response = await axios.get(url, { headers, validateStatus: () => true });

            assert.strictEqual(response.status, expectedStatus, `Expected status ${expectedStatus}, got ${response.status}`);

            if (skipDataCheck) {
                skipDataCheck(response.data);
            }

            console.log("✅ PASSED");
            passed++;
        } catch (error) {
            console.log(`❌ FAILED`);
            console.error(`   Error details: ${error.message}`);
            if (error.response) console.error(`   Response:`, error.response.data);
            failed++;
        }
    }

    // 1. Test 404 Not Found (User not in given course)
    await executeTest(
        "User fetching invalid/unregistered course -> 404",
        `${BASE_URL}/api/student/exam-seat?courseCode=999999999`,
        {},
        404,
        (data) => assert.strictEqual(data.error, 'Student not found in this exam course')
    );

    // 2. Test Success Seat Map (User 1 - 40433001)
    await executeTest(
        "Valid Seat Map fetch (Course 40433001)",
        `${BASE_URL}/api/student/exam-seat?courseCode=40433001`,
        {},
        200,
        (data) => {
            assert.ok(data.courseInfo, "Should have courseInfo");
            assert.strictEqual(data.courseInfo.courseCode, "40433001");
            assert.ok(data.gridDimensions, "Should have gridDimensions");
            assert.ok(data.gridDimensions.rows > 0, "Grid rows should be >= 0");
            assert.ok(data.gridDimensions.cols > 0, "Grid cols should be >= 0");
            assert.ok(Array.isArray(data.seats), "Seats should be an array");
            assert.strictEqual(data.currentUserDetails.studentId, "6301011610279");
        }
    );

    console.log(`\n--- Test Results ---`);
    console.log(`Total: ${passed + failed}, Passed: ${passed}, Failed: ${failed}`);
    if (failed > 0) process.exit(1);
}

runTests();
