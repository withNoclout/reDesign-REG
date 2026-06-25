'use client';

import { useEffect } from 'react';
import { logError } from '@/lib/logger';
import PortalStatusScreen from '../components/PortalStatusScreen';

export default function GradeError({ error, reset }) {
    useEffect(() => {
        console.error('Grade Error:', error);
        logError(error, 'GradeErrorPage');
    }, [error]);

    return (
        <PortalStatusScreen
            onRetry={reset}
            subtitle={error?.message || 'ไม่สามารถแสดงผลการเรียนได้'}
            title="เกิดข้อผิดพลาดในหน้าผลการเรียน"
        />
    );
}
