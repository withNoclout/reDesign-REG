import { redirect } from 'next/navigation';

import MainPageClient from '@/app/main/MainPageClient';
import { getAuthContextStatus } from '@/lib/auth';

function readSingleParam(params, key) {
    const value = params?.[key];
    if (Array.isArray(value)) {
        return value[0] || '';
    }
    return typeof value === 'string' ? value : '';
}

// Next.js App Router provides searchParams for server pages; runtime validates shape.
// eslint-disable-next-line react/prop-types
export default async function Page({ searchParams }) {
    const params = await searchParams;
    const guestToken = readSingleParam(params, 't');

    if (!guestToken) {
        const { authContext } = await getAuthContextStatus();
        if (!authContext?.userId) {
            redirect('/?session=expired');
        }
    }

    return <MainPageClient />;
}
