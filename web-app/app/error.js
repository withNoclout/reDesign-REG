'use client';

import { useEffect } from 'react';
import { logError } from '@/lib/logger';
import PortalStatusScreen from './components/PortalStatusScreen';

export default function Error({ error, reset }) {
    useEffect(() => {
        console.error('Application Error:', error);
        logError(error, 'GlobalErrorPage');
    }, [error]);

    return (
        <PortalStatusScreen
            details={process.env.NODE_ENV === 'development' ? (error?.message || 'Unknown error') : null}
            onRetry={reset}
            subtitle="Something went wrong"
            title="เกิดข้อผิดพลาด"
        />
    );
}
