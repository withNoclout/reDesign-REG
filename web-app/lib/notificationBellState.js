export const GUEST_PROMPT_STORAGE_PREFIX = 'reg_notification_prompt_hidden_v2';

export function buildGuestPromptStorageKey(notificationId) {
    return `${GUEST_PROMPT_STORAGE_PREFIX}:${notificationId}`;
}

export function removeNotificationById(feed, notificationId) {
    const nextSections = {
        actionRequired: feed.sections.actionRequired.filter((item) => item.id !== notificationId),
        latest: feed.sections.latest.filter((item) => item.id !== notificationId),
        upcoming: feed.sections.upcoming.filter((item) => item.id !== notificationId),
    };

    return {
        ...feed,
        sections: {
            ...nextSections,
            all: [...nextSections.actionRequired, ...nextSections.latest, ...nextSections.upcoming],
        },
        counts: {
            total: Math.max(0, feed.counts.total - 1),
            unread: Math.max(0, feed.counts.unread - (feed.sections.all.find((item) => item.id === notificationId)?.unread ? 1 : 0)),
            actionRequired: Math.max(0, feed.counts.actionRequired - (feed.sections.actionRequired.some((item) => item.id === notificationId) ? 1 : 0)),
        },
    };
}

export function markNotificationAsRead(feed, notificationId) {
    let unreadDelta = 0;
    const mapItem = (item) => {
        if (item.id !== notificationId) return item;
        if (item.unread) unreadDelta += 1;
        return { ...item, unread: false };
    };

    const nextSections = {
        actionRequired: feed.sections.actionRequired.map(mapItem),
        latest: feed.sections.latest.map(mapItem),
        upcoming: feed.sections.upcoming.map(mapItem),
    };

    return {
        ...feed,
        sections: {
            ...nextSections,
            all: [...nextSections.actionRequired, ...nextSections.latest, ...nextSections.upcoming],
        },
        counts: {
            ...feed.counts,
            unread: Math.max(0, feed.counts.unread - unreadDelta),
        },
    };
}

export function filterGuestDismissedPromptItems(feed, dismissedPromptIds = []) {
    if (feed.viewer.authenticated) return feed;

    const dismissedSet = dismissedPromptIds instanceof Set
        ? dismissedPromptIds
        : new Set(Array.isArray(dismissedPromptIds) ? dismissedPromptIds : []);
    const isVisible = (item) => !(item.kind === 'system_prompt' && dismissedSet.has(item.id));
    const nextSections = {
        actionRequired: feed.sections.actionRequired.filter(isVisible),
        latest: feed.sections.latest.filter(isVisible),
        upcoming: feed.sections.upcoming.filter(isVisible),
    };

    return {
        ...feed,
        sections: {
            ...nextSections,
            all: [...nextSections.actionRequired, ...nextSections.latest, ...nextSections.upcoming],
        },
        counts: {
            total: [...nextSections.actionRequired, ...nextSections.latest, ...nextSections.upcoming].length,
            unread: [...nextSections.actionRequired, ...nextSections.latest, ...nextSections.upcoming].filter((item) => item.unread).length,
            actionRequired: nextSections.actionRequired.length,
        },
    };
}
