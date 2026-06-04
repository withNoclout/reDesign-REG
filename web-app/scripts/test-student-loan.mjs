import test from 'node:test';
import assert from 'node:assert/strict';

import {
    inferStepStatusFromText,
    parseContinuingWindowsFromText,
    parseNewBorrowerStageWindowsFromText,
    parseNewPreApproveWindowsFromText,
} from '../lib/studentLoanContent.js';
import {
    buildActiveStudentLoanNotifications,
    inferBorrowerProfile,
} from '../lib/studentLoanService.js';
import { buildStudentLoanNotificationInstanceRecord } from '../lib/studentLoanCentralService.js';

test('parseContinuingWindowsFromText extracts bachelor window events', () => {
    const text = 'ระดับ ป.ตรี เปิดระบบวันที่ 1 พฤษภาคม 2569 เวลา 10.00 น. ปิดระบบวันที่ 31 พฤษภาคม 2569 เวลา 23.59 น.';
    const events = parseContinuingWindowsFromText(text, 'https://example.test/checklist');

    assert.equal(events.length, 2);
    assert.equal(events[0].audience, 'continuing');
    assert.equal(events[0].educationLevel, 'bachelor');
    assert.equal(events[0].phase, 'open');
    assert.equal(events[1].phase, 'closingSoon');
    assert.equal(events[0].href, 'https://example.test/checklist');
    assert.equal(events[0].opensAt, '2026-05-01T03:00:00.000Z');
    assert.equal(events[0].closesAt, '2026-05-31T16:59:00.000Z');
});

test('parseNewPreApproveWindowsFromText extracts bachelor pre-approve events', () => {
    const text = '✅ 1.2 สำหรับ ป.ตรี วันที่ 1-20 มิ.ย. 2569';
    const events = parseNewPreApproveWindowsFromText(text, 'https://example.test/preapprove');

    assert.equal(events.length, 2);
    assert.equal(events[0].audience, 'new');
    assert.equal(events[0].educationLevel, 'bachelor');
    assert.equal(events[0].phase, 'open');
    assert.equal(events[0].opensAt, '2026-05-31T17:00:00.000Z');
    assert.equal(events[0].closesAt, '2026-06-20T16:59:00.000Z');
});

test('parseNewBorrowerStageWindowsFromText extracts downstream stage windows when published', () => {
    const text = 'ระดับ ป.ตรี เปิดให้ทำวันที่ 21 มิถุนายน 2569';
    const events = parseNewBorrowerStageWindowsFromText(text, {
        href: 'https://example.test/dsl',
        stage: 'dsl-request',
        sourceId: 'new-step-2',
    });

    assert.equal(events.length, 2);
    assert.equal(events[0].audience, 'new');
    assert.equal(events[0].educationLevel, 'bachelor');
    assert.equal(events[0].stage, 'dsl-request');
    assert.equal(events[0].title, 'ผู้กู้รายใหม่ ป.ตรี ยื่นคำขอกู้ในระบบ DSL / กยศ. Connect');
    assert.equal(events[0].opensAt, '2026-06-20T17:00:00.000Z');
    assert.equal(events[0].closesAt, '2026-06-21T16:59:00.000Z');
});

test('inferStepStatusFromText marks unpublished downstream steps as pending announcement', () => {
    const text = 'ขั้นตอนนี้ยังไม่เปิดให้ทำ ให้รอประกาศจากสถานศึกษา';
    assert.equal(inferStepStatusFromText(text), 'pendingAnnouncement');
});

test('buildStudentLoanNotificationInstanceRecord keeps open alert dismissed after click', () => {
    const record = buildStudentLoanNotificationInstanceRecord({
        event: {
            eventId: 'loan-open',
            dismissStrategy: 'click',
            visibleFrom: '2026-05-01T03:00:00.000Z',
            visibleUntil: '2026-05-31T16:59:00.000Z',
        },
        existingInstance: {
            userCode: '6701091611290',
            clickedAt: '2026-05-10T05:05:00.000Z',
        },
        materializeNow: new Date('2026-05-26T12:00:00+07:00'),
        preview: true,
    });

    assert.equal(record.status, 'clicked');
    assert.equal(record.clickedAt, '2026-05-10T05:05:00.000Z');
    assert.equal(record.resolutionReason, 'click');
});

test('buildStudentLoanNotificationInstanceRecord keeps closing soon alert active until expiry', () => {
    const active = buildStudentLoanNotificationInstanceRecord({
        event: {
            eventId: 'loan-closing',
            dismissStrategy: 'expiry',
            visibleFrom: '2026-05-24T16:59:00.000Z',
            visibleUntil: '2026-05-31T16:59:00.000Z',
        },
        existingInstance: {
            userCode: '6701091611290',
            clickedAt: null,
        },
        materializeNow: new Date('2026-05-26T12:00:00+07:00'),
        preview: true,
    });

    const expired = buildStudentLoanNotificationInstanceRecord({
        event: {
            eventId: 'loan-closing',
            dismissStrategy: 'expiry',
            visibleFrom: '2026-05-24T16:59:00.000Z',
            visibleUntil: '2026-05-31T16:59:00.000Z',
        },
        existingInstance: {
            userCode: '6701091611290',
            clickedAt: null,
        },
        materializeNow: new Date('2026-06-01T12:00:00+07:00'),
        preview: true,
    });

    assert.equal(active.status, 'active');
    assert.equal(expired.status, 'expired');
    assert.equal(expired.resolutionReason, 'expiry');
});

test('buildActiveStudentLoanNotifications hides first alert after click but keeps closing soon alert', () => {
    const events = parseContinuingWindowsFromText(
        'ระดับ ป.ตรี เปิดระบบวันที่ 1 พฤษภาคม 2569 เวลา 10.00 น. ปิดระบบวันที่ 31 พฤษภาคม 2569 เวลา 23.59 น.',
        'https://example.test/checklist'
    );

    const borrowerProfile = { borrowerType: 'continuing', educationLevel: 'bachelor' };
    const duringOpenWindow = new Date('2026-05-10T12:00:00+07:00');
    const visibleBeforeClick = buildActiveStudentLoanNotifications(events, borrowerProfile, {}, duringOpenWindow);

    assert.deepEqual(visibleBeforeClick.map((item) => item.phase), ['open']);

    const visibleAfterClick = buildActiveStudentLoanNotifications(
        events,
        borrowerProfile,
        { [events[0].id]: '2026-05-10T12:05:00+07:00' },
        duringOpenWindow
    );

    assert.equal(visibleAfterClick.length, 0);

    const closingSoonWindow = new Date('2026-05-26T12:00:00+07:00');
    const visibleClosingSoon = buildActiveStudentLoanNotifications(
        events,
        borrowerProfile,
        { [events[0].id]: '2026-05-10T12:05:00+07:00' },
        closingSoonWindow
    );

    assert.deepEqual(visibleClosingSoon.map((item) => item.phase), ['closingSoon']);
});

test('inferBorrowerProfile recommends continuing for students with more than two semesters', () => {
    const profile = inferBorrowerProfile({
        userCode: '6701091611290',
        studentProfile: {
            admitYear: 2567,
            enrollYear: 2567,
            enrollSemester: 1,
            currentYear: 2568,
            currentSemester: 2,
            major: 'วิศวกรรมคอมพิวเตอร์ ปริญญาตรี',
        },
    });

    assert.equal(profile.borrowerType, 'continuing');
    assert.equal(profile.educationLevel, 'bachelor');
    assert.equal(profile.estimatedCompletedSemesters, 5);
});
