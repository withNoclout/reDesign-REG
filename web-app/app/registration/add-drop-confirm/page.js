import { redirectToMainMenu } from '@/app/redirectToMainMenu';

export default function Page({ searchParams }) {
    return redirectToMainMenu('registry', searchParams);
}