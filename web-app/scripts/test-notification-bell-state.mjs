import assert from 'node:assert/strict';
import test from 'node:test';

import {
    filterGuestDismissedPromptItems,
    markNotificationAsRead,
    removeNotificationById,
} from '../lib/notificationBellState.js';

function buildFeed(items, { authenticated = false } = {}) {
    return {
        viewer: { authenticated, userCode: authenticated ? '6701091611290' : null },
        sections: {
            actionRequired: items.filter((item) => item.section === 'actionRequired'),
            latest: items.filter((item) => item.section === 'latest'),
            upcoming: items.filter((item) => item.section === 'upcoming'),
            all: items,
        },
        counts: {
            total: items.length,
            unread: items.filter((item) => item.unread).length,
            actionRequired: items.filter((item) => item.section === 'actionRequired').length,
        },
    };
}

test('filterGuestDismissedPromptItems removes only dismissed system prompts for guests', () => {
    const feed = buildFeed([
        { id: 'prompt-a', kind: 'system_prompt', section: 'actionRequired', unread: true },
        { id: 'prompt-b', kind: 'system_prompt', section: 'actionRequired', unread: true },
        { id: 'classroom-1', kind: 'event', section: 'latest', unread: true },
    ]);

    const filtered = filterGuestDismissedPromptItems(feed, new Set(['prompt-a']));

    assert.deepEqual(filtered.sections.actionRequired.map((item) => item.id), ['prompt-b']);
    assert.deepEqual(filtered.sections.latest.map((item) => item.id), ['classroom-1']);
    assert.equal(filtered.counts.total, 2);
    assert.equal(filtered.counts.unread, 2);
    assert.equal(filtered.counts.actionRequired, 1);
});

test('filterGuestDismissedPromptItems leaves authenticated feeds unchanged', () => {
    const feed = buildFeed([
        { id: 'prompt-a', kind: 'system_prompt', section: 'actionRequired', unread: true },
    ], { authenticated: true });

    const filtered = filterGuestDismissedPromptItems(feed, new Set(['prompt-a']));
    assert.deepEqual(filtered, feed);
});

test('markNotificationAsRead only updates the targeted notification and unread count', () => {
    const feed = buildFeed([
        { id: 'one', kind: 'event', section: 'latest', unread: true },
        { id: 'two', kind: 'event', section: 'latest', unread: false },
    ]);

    const next = markNotificationAsRead(feed, 'one');
    assert.equal(next.sections.latest[0].unread, false);
    assert.equal(next.sections.latest[1].unread, false);
    assert.equal(next.counts.unread, 0);
});

test('removeNotificationById updates section and aggregate counts consistently', () => {
    const feed = buildFeed([
        { id: 'one', kind: 'system_prompt', section: 'actionRequired', unread: true },
        { id: 'two', kind: 'event', section: 'latest', unread: false },
    ]);

    const next = removeNotificationById(feed, 'one');
    assert.deepEqual(next.sections.actionRequired, []);
    assert.deepEqual(next.sections.all.map((item) => item.id), ['two']);
    assert.equal(next.counts.total, 1);
    assert.equal(next.counts.unread, 0);
    assert.equal(next.counts.actionRequired, 0);
});
