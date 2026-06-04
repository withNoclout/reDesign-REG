import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildGoogleClassroomAuthorizeUrl,
    createGoogleClassroomFlow,
    normalizeGoogleClassroomUserInfo,
    verifyGoogleClassroomFlowCookie,
} from '../lib/googleClassroom.js';
import { buildGoogleClassroomNotificationsSnapshot } from '../lib/googleClassroomService.js';

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
    process.env = {
        ...ORIGINAL_ENV,
        JWT_SECRET: 'test-secret',
        GOOGLE_CLASSROOM_CLIENT_ID: 'client-id',
        GOOGLE_CLASSROOM_CLIENT_SECRET: 'client-secret',
        GOOGLE_CLASSROOM_REDIRECT_URI: 'https://example.test/api/classroom/auth/callback',
        GOOGLE_CLASSROOM_TOKEN_ENCRYPTION_KEY: 'encryption-secret',
        NEXT_PUBLIC_LANDING_PATH: '/main',
    };
}

test.beforeEach(() => {
    resetEnv();
});

test.after(() => {
    process.env = ORIGINAL_ENV;
});

test('google classroom oauth flow preserves state, user, and safe return target', () => {
    const flow = createGoogleClassroomFlow('6701091611290', '/profile?tab=notifications');
    const verified = verifyGoogleClassroomFlowCookie(flow.cookieValue, flow.state);
    const authorizeUrl = new URL(buildGoogleClassroomAuthorizeUrl(flow));

    assert.equal(verified.userCode, '6701091611290');
    assert.equal(verified.returnTo, '/profile?tab=notifications');
    assert.equal(authorizeUrl.searchParams.get('client_id'), 'client-id');
    assert.equal(authorizeUrl.searchParams.get('redirect_uri'), 'https://example.test/api/classroom/auth/callback');
    assert.equal(authorizeUrl.searchParams.get('access_type'), 'offline');
    assert.equal(authorizeUrl.searchParams.get('prompt'), 'consent');
    assert.equal(authorizeUrl.searchParams.get('state'), flow.state);
    assert.equal(authorizeUrl.searchParams.get('code_challenge_method'), 'S256');
});

test('normalizeGoogleClassroomUserInfo extracts stable user fields', () => {
    const normalized = normalizeGoogleClassroomUserInfo({
        sub: 'google-user-1',
        email: 'student@example.edu',
        email_verified: true,
        name: 'Student Name',
        given_name: 'Student',
        family_name: 'Name',
        picture: 'https://example.edu/avatar.png',
    });

    assert.deepEqual(normalized, {
        subject: 'google-user-1',
        email: 'student@example.edu',
        emailVerified: true,
        displayName: 'Student Name',
        givenName: 'Student',
        familyName: 'Name',
        pictureUrl: 'https://example.edu/avatar.png',
        raw: {
            sub: 'google-user-1',
            email: 'student@example.edu',
            email_verified: true,
            name: 'Student Name',
            given_name: 'Student',
            family_name: 'Name',
            picture: 'https://example.edu/avatar.png',
        },
    });
});

test('buildGoogleClassroomNotificationsSnapshot emits recent announcement, coursework, and returned submission notifications', () => {
    const now = new Date('2026-06-03T12:00:00.000Z');
    const notifications = buildGoogleClassroomNotificationsSnapshot({
        courses: [
            { id: 'course-1', name: 'Web Engineering', alternateLink: 'https://classroom.google.com/c/course-1' },
        ],
        announcementsByCourseId: {
            'course-1': [
                {
                    id: 'announcement-1',
                    text: 'อาจารย์ประกาศงานกลุ่มสัปดาห์นี้',
                    updateTime: '2026-06-03T11:55:00.000Z',
                    alternateLink: 'https://classroom.google.com/c/course-1/m/announcement-1',
                },
            ],
        },
        courseWorkByCourseId: {
            'course-1': [
                {
                    id: 'coursework-1',
                    title: 'Lab 7',
                    description: 'ส่งภายในคืนนี้',
                    workType: 'ASSIGNMENT',
                    updateTime: '2026-06-03T11:50:00.000Z',
                    alternateLink: 'https://classroom.google.com/c/course-1/a/coursework-1/details',
                },
            ],
        },
        submissionsByCourseId: {
            'course-1': [
                {
                    id: 'submission-1',
                    courseWorkId: 'coursework-1',
                    state: 'RETURNED',
                    assignedGrade: 9.5,
                    updateTime: '2026-06-03T11:58:00.000Z',
                    alternateLink: 'https://classroom.google.com/c/course-1/a/coursework-1/details',
                },
                {
                    id: 'submission-2',
                    courseWorkId: 'coursework-1',
                    state: 'CREATED',
                    updateTime: '2026-06-03T11:40:00.000Z',
                },
            ],
        },
    }, now);

    assert.equal(notifications.length, 3);
    assert.equal(notifications[0].sourceType, 'studentSubmission');
    assert.equal(notifications[0].title, 'Web Engineering: ส่งคืนงานแล้ว');
    assert.equal(notifications[0].message, 'Lab 7 คะแนน 9.5');
    assert.equal(notifications[1].sourceType, 'announcement');
    assert.equal(notifications[2].sourceType, 'courseWork');
    assert.match(notifications[2].message, /Lab 7/);
});
