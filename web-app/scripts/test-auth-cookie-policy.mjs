import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAuthCookieOptions, isIpPreviewRequest, shouldUseSecureAuthCookies } from '../lib/authCookiePolicy.mjs';

function makeRequest({ host, proto }) {
    return {
        headers: new Headers({
            host,
            'x-forwarded-host': host,
            'x-forwarded-proto': proto,
        }),
        nextUrl: new URL(`${proto}://${host}/`),
    };
}

test('shouldUseSecureAuthCookies keeps secure cookies on production domain traffic', () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
        assert.equal(shouldUseSecureAuthCookies(makeRequest({ host: 'redesign-reg.kmutnb.ac.th', proto: 'https' })), true);
        assert.equal(shouldUseSecureAuthCookies(makeRequest({ host: 'redesign-reg.kmutnb.ac.th', proto: 'http' })), true);
    } finally {
        if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previousNodeEnv;
    }
});

test('shouldUseSecureAuthCookies allows HTTP cookies only for configured IP preview hosts', () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
        assert.equal(shouldUseSecureAuthCookies(makeRequest({ host: '172.16.214.69', proto: 'http' })), false);
        assert.equal(shouldUseSecureAuthCookies(makeRequest({ host: '202.44.32.253', proto: 'http' })), false);
        assert.equal(shouldUseSecureAuthCookies(makeRequest({ host: '172.16.214.69', proto: 'https' })), true);
    } finally {
        if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previousNodeEnv;
    }
});

test('isIpPreviewRequest matches configured IP hosts only', () => {
    assert.equal(isIpPreviewRequest(makeRequest({ host: '172.16.214.69', proto: 'http' })), true);
    assert.equal(isIpPreviewRequest(makeRequest({ host: '202.44.32.253', proto: 'https' })), true);
    assert.equal(isIpPreviewRequest(makeRequest({ host: 'redesign-reg.kmutnb.ac.th', proto: 'https' })), false);
});

test('buildAuthCookieOptions mirrors secure policy and maxAge', () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
        const options = buildAuthCookieOptions(makeRequest({ host: '172.16.214.69', proto: 'http' }), 3300);
        assert.deepEqual(options, {
            httpOnly: true,
            secure: false,
            path: '/',
            sameSite: 'lax',
            maxAge: 3300,
        });
    } finally {
        if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previousNodeEnv;
    }
});
