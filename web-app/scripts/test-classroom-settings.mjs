import assert from 'node:assert/strict';
import test from 'node:test';

import { getGoogleClassroomBaseScopes, resolveGoogleClassroomScopes } from '../lib/googleClassroom.js';
import { getGoogleClassroomRolloutState } from '../lib/googleClassroomRollout.js';
import {
    buildGoogleClassroomFeatureCatalog,
    extractGoogleClassroomSettings,
    normalizeGoogleClassroomFeatureSelection,
} from '../lib/googleClassroomSettings.js';

test('normalizeGoogleClassroomFeatureSelection keeps core features enabled and disables push when unavailable', () => {
    const selection = normalizeGoogleClassroomFeatureSelection({
        announcements: false,
        coursework: false,
        returnedWork: false,
        pushSync: true,
    }, { pushAvailable: false });

    assert.deepEqual(selection, {
        announcements: true,
        coursework: true,
        returnedWork: true,
        pushSync: false,
    });
});

test('extractGoogleClassroomSettings returns defaults when namespace is missing', () => {
    const settings = extractGoogleClassroomSettings({}, { pushAvailable: true });
    assert.deepEqual(settings, {
        selectedFeatures: {
            announcements: true,
            coursework: true,
            returnedWork: true,
            pushSync: false,
        },
    });
});

test('resolveGoogleClassroomScopes adds push scope only when requested and available', () => {
    const baseScopes = getGoogleClassroomBaseScopes();
    const withPush = resolveGoogleClassroomScopes({ pushSync: true }, { pushConfigured: true });
    const withoutPush = resolveGoogleClassroomScopes({ pushSync: true }, { pushConfigured: false });

    assert.deepEqual(withoutPush, baseScopes);
    assert.equal(withPush.includes('https://www.googleapis.com/auth/classroom.push-notifications'), true);
    assert.equal(withPush.includes('https://www.googleapis.com/auth/classroom.coursework.students.readonly'), false);
});

test('buildGoogleClassroomFeatureCatalog marks push availability correctly', () => {
    const unavailable = buildGoogleClassroomFeatureCatalog({ pushAvailable: false });
    const available = buildGoogleClassroomFeatureCatalog({ pushAvailable: true });

    const pushUnavailable = unavailable.find((item) => item.key === 'pushSync');
    const pushAvailable = available.find((item) => item.key === 'pushSync');

    assert.equal(pushUnavailable.available, false);
    assert.equal(pushAvailable.available, true);
});

test('getGoogleClassroomRolloutState defaults to pilot allowlist for current pilot user', () => {
    const previousMode = process.env.GOOGLE_CLASSROOM_ROLLOUT_MODE;
    const previousUsers = process.env.GOOGLE_CLASSROOM_ROLLOUT_USERS;

    delete process.env.GOOGLE_CLASSROOM_ROLLOUT_MODE;
    delete process.env.GOOGLE_CLASSROOM_ROLLOUT_USERS;

    assert.deepEqual(getGoogleClassroomRolloutState('6701091611290'), {
        mode: 'pilot',
        enabled: true,
        reason: 'pilot_allowlist',
        userCode: '6701091611290',
    });
    assert.deepEqual(getGoogleClassroomRolloutState('6701091611291'), {
        mode: 'pilot',
        enabled: false,
        reason: 'pilot_restricted',
        userCode: '6701091611291',
    });

    if (previousMode === undefined) {
        delete process.env.GOOGLE_CLASSROOM_ROLLOUT_MODE;
    } else {
        process.env.GOOGLE_CLASSROOM_ROLLOUT_MODE = previousMode;
    }

    if (previousUsers === undefined) {
        delete process.env.GOOGLE_CLASSROOM_ROLLOUT_USERS;
    } else {
        process.env.GOOGLE_CLASSROOM_ROLLOUT_USERS = previousUsers;
    }
});
