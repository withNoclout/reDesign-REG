import assert from 'node:assert/strict';
import test from 'node:test';

import { getGoogleClassroomMailScopes } from '../lib/googleClassroomMail.js';
import { parseGoogleClassroomMailNotification } from '../lib/googleClassroomMailParser.js';

test('getGoogleClassroomMailScopes returns gmail readonly scope set', () => {
    const scopes = getGoogleClassroomMailScopes();
    assert.equal(scopes.includes('https://www.googleapis.com/auth/gmail.readonly'), true);
    assert.equal(scopes.includes('https://www.googleapis.com/auth/classroom.courses.readonly'), false);
});

test('parseGoogleClassroomMailNotification recognizes returned work notification', () => {
    const notification = parseGoogleClassroomMailNotification({
        id: 'msg-1',
        threadId: 'thread-1',
        internalDate: String(Date.parse('2026-06-03T12:00:00.000Z')),
        snippet: 'Your work was returned and graded in Google Classroom',
        labelIds: ['INBOX'],
        headers: {
            from: 'Google Classroom <no-reply@classroom.google.com>',
            subject: 'Returned: Lab 7',
        },
        textBody: 'Your work was returned and graded. Open in https://classroom.google.com/c/abc',
        htmlBody: '',
        historyId: 'history-1',
    });

    assert.equal(notification.sourceType, 'returnedWork');
    assert.equal(notification.href, 'https://classroom.google.com/c/abc');
    assert.match(notification.title, /Returned: Lab 7/);
});

test('parseGoogleClassroomMailNotification ignores unrelated mail', () => {
    const notification = parseGoogleClassroomMailNotification({
        id: 'msg-2',
        threadId: 'thread-2',
        internalDate: String(Date.now()),
        snippet: 'Your invoice is ready',
        labelIds: ['INBOX'],
        headers: {
            from: 'Billing <billing@example.com>',
            subject: 'Invoice',
        },
        textBody: 'No classroom content here',
        htmlBody: '',
        historyId: 'history-2',
    });

    assert.equal(notification, null);
});
