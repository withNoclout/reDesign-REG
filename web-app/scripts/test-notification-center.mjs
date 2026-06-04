import assert from 'node:assert/strict';
import test from 'node:test';

import { buildUnifiedNotificationSections } from '../lib/notificationCenterService.js';
import { extractNotificationCenterPreferences } from '../lib/notificationPreferences.js';

test('buildUnifiedNotificationSections groups and sorts notifications by section semantics', () => {
    const sections = buildUnifiedNotificationSections([
        {
            id: 'latest-older',
            section: 'latest',
            priority: 'normal',
            sortAt: '2026-06-01T10:00:00.000Z',
            unread: false,
        },
        {
            id: 'action-normal',
            section: 'actionRequired',
            priority: 'normal',
            sortAt: '2026-06-02T10:00:00.000Z',
            unread: false,
        },
        {
            id: 'upcoming-later',
            section: 'upcoming',
            priority: 'normal',
            sortAt: '2026-06-10T10:00:00.000Z',
            unread: false,
        },
        {
            id: 'latest-newer',
            section: 'latest',
            priority: 'high',
            sortAt: '2026-06-03T10:00:00.000Z',
            unread: true,
        },
        {
            id: 'action-critical',
            section: 'actionRequired',
            priority: 'critical',
            sortAt: '2026-06-01T12:00:00.000Z',
            unread: true,
        },
        {
            id: 'upcoming-sooner',
            section: 'upcoming',
            priority: 'high',
            sortAt: '2026-06-05T10:00:00.000Z',
            unread: false,
        },
    ]);

    assert.deepEqual(sections.actionRequired.map((item) => item.id), ['action-critical', 'action-normal']);
    assert.deepEqual(sections.latest.map((item) => item.id), ['latest-newer', 'latest-older']);
    assert.deepEqual(sections.upcoming.map((item) => item.id), ['upcoming-sooner', 'upcoming-later']);
    assert.deepEqual(sections.all.map((item) => item.id), [
        'action-critical',
        'action-normal',
        'latest-newer',
        'latest-older',
        'upcoming-sooner',
        'upcoming-later',
    ]);
});

test('extractNotificationCenterPreferences keeps only valid dismissed prompt timestamps', () => {
    const preferences = extractNotificationCenterPreferences({
        notificationCenter: {
            dismissedPromptIds: {
                'classroom:prompt:connect-required': '2026-06-03T12:00:00.000Z',
                badTimestamp: 'not-a-date',
                '': '2026-06-03T12:00:00.000Z',
            },
        },
    });

    assert.deepEqual(preferences, {
        dismissedPromptIds: {
            'classroom:prompt:connect-required': '2026-06-03T12:00:00.000Z',
        },
    });
});
