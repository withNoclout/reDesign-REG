import { redirect } from 'next/navigation';

function readSingleParam(params, key) {
    const value = params?.[key];
    if (Array.isArray(value)) return value[0] || '';
    return typeof value === 'string' ? value : '';
}

export async function redirectToMainMenu(menu, searchParams) {
    const params = await searchParams;
    const target = new URLSearchParams({ menu });
    const token = readSingleParam(params, 't');

    if (token) {
        target.set('t', token);
    }

    redirect(`/main?${target.toString()}`);
}
